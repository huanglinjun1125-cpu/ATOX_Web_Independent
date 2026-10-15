import { and, desc, eq, ne } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import { eventTeams, teamMembers, teamApplications } from "./schema";
import { getEventConfig } from "../event-board/config";
import { buildEventService } from "../event-participation/service";
import type { EventDefinition } from "../event-board/contracts";
import type { AuthUser } from "../auth/contracts";
import type {
  TeamInput,
  TeamCard,
  CenterDto,
  ApplicationDto,
  TeamCommand,
} from "./contracts";
import { centerConfig, centerOpen } from "./config";
import { CenterError } from "./errors";
type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Db | Tx;
type Team = typeof eventTeams.$inferSelect;
type Member = typeof teamMembers.$inferSelect;
type Application = typeof teamApplications.$inferSelect;
const uuid = (v: unknown) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    throw new CenterError("INVALID_INPUT", 400);
  return v;
};
const text = (v: unknown, max: number) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new CenterError("INVALID_INPUT", 400);
  return v.trim();
};
export function forCenter(eventId: string) {
  const event = getEventConfig(eventId);
  if (!event) throw new CenterError("NOT_FOUND", 404);
  return buildCenter(event);
}
export function buildCenter(
  event: EventDefinition,
  configReader?: (db?: Reader) => Promise<EventDefinition | null>,
) {
  const eventId = event.id;
  let config = centerConfig(event);
  const participation = buildEventService(event, configReader);
  const scopedTeam = (id: string) =>
    and(eq(eventTeams.id, id), eq(eventTeams.eventId, eventId));
  async function rows(db: Reader) {
    return {
      teams: await db
        .select()
        .from(eventTeams)
        .where(eq(eventTeams.eventId, eventId))
        .orderBy(desc(eventTeams.createdAt), desc(eventTeams.id)),
      members: await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.eventId, eventId)),
      applications: await db
        .select()
        .from(teamApplications)
        .where(eq(teamApplications.eventId, eventId))
        .orderBy(desc(teamApplications.createdAt)),
    };
  }
  function card(team: Team, members: Member[], now: Date): TeamCard {
    const roster = members.filter((m) => m.teamId === team.id);
    const count = roster.length;
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      trackId: team.trackId,
      skills: team.skills,
      recruitment: team.recruitment,
      capacity: team.capacity,
      count,
      vacancies: Math.max(0, team.capacity - count),
      captainName:
        roster.find((m) => m.userId === team.captainId)?.displayName ?? "",
      recruiting: team.recruiting,
      revision: team.revision,
      createdAt: team.createdAt.toISOString(),
      stage: team.dissolved
        ? "dissolved"
        : !centerOpen(config, now)
          ? "closed"
          : count >= team.capacity
            ? "full"
            : !team.recruiting
              ? "paused"
              : "recruiting",
    };
  }
  function applicationDto(
    a: Application,
    teams: Team[],
    members: Member[],
    now: Date,
  ): ApplicationDto {
    const team = teams.find((t) => t.id === a.teamId)!;
    let reason = a.reason;
    let status = a.status;
    if (status === "pending") {
      if (now.getTime() >= Date.parse(config.closesAt)) reason = "CLOSED";
      else if (team.dissolved) reason = "DISSOLVED";
      else if (
        members.filter((m) => m.teamId === team.id).length >= team.capacity
      )
        reason = "FULL";
      if (reason) status = "expired";
    }
    return {
      id: a.id,
      teamId: a.teamId,
      teamName: team.name,
      applicantId: a.userId,
      displayName: a.displayName,
      role: a.role,
      skills: a.skills,
      message: a.message,
      status,
      reason,
      stillMember:
        status === "accepted" &&
        members.some((m) => m.userId === a.userId && m.teamId === a.teamId),
      createdAt: a.createdAt.toISOString(),
    };
  }
  async function list() {
    const db = await getDb();
    // Public read does not select application messages or member roles.
    return db.transaction(async (tx) => {
      const teams = await tx
        .select()
        .from(eventTeams)
        .where(
          and(eq(eventTeams.eventId, eventId), eq(eventTeams.dissolved, false)),
        )
        .orderBy(desc(eventTeams.createdAt), desc(eventTeams.id));
      const members = await tx
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.eventId, eventId));
      return { teams: teams.map((t) => card(t, members, new Date())) };
    });
  }
  async function get(user: AuthUser): Promise<CenterDto> {
    const registration = await participation.getRegisteredParticipant(user.id);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const data = await rows(tx),
        now = new Date();
      const mine = data.members.find((m) => m.userId === user.id);
      const team = mine
        ? data.teams.find((t) => t.id === mine.teamId && !t.dissolved)
        : undefined;
      const isCaptain = team?.captainId === user.id;
      return {
        team: team
          ? {
              ...card(team, data.members, now),
              members: data.members
                .filter((m) => m.teamId === team.id)
                .map((m) => ({
                  userId: m.userId,
                  displayName: m.displayName,
                  role: m.role,
                  captain: m.userId === team.captainId,
                })),
            }
          : null,
        applications: data.applications
          .filter((a) => a.userId === user.id)
          .map((a) => applicationDto(a, data.teams, data.members, now)),
        incoming: isCaptain
          ? data.applications
              .filter((a) => a.teamId === team!.id && a.status === "pending")
              .map((a) => applicationDto(a, data.teams, data.members, now))
              .filter((a) => a.status === "pending")
          : [],
        registered: !!registration,
        canManage: !!registration && centerOpen(config, now),
        isCaptain,
        ...config,
        serverNow: now.toISOString(),
      };
    });
  }
  function input(value: unknown): TeamInput {
    if (!value || typeof value !== "object")
      throw new CenterError("INVALID_INPUT", 400);
    const v = value as TeamInput;
    if (
      !Number.isInteger(v.capacity) ||
      v.capacity < config.minSize ||
      v.capacity > config.maxSize ||
      !event!.tracks.some((t) => t.id === v.trackId)
    )
      throw new CenterError("INVALID_INPUT", 400);
    return {
      name: text(v.name, 80),
      description: text(v.description, 600),
      trackId: v.trackId,
      skills: text(v.skills, 200),
      recruitment: text(v.recruitment, 1000),
      capacity: v.capacity,
    };
  }
  async function execute(user: AuthUser, raw: unknown) {
    if (!raw || typeof raw !== "object" || !("action" in raw))
      throw new CenterError("INVALID_INPUT", 400);
    const command = raw as TeamCommand;
    await serializeDatabaseWrite(async () => {
      const db = await getDb();
      const reg = await participation.getRegisteredParticipant(user.id);
      if (!reg) throw new CenterError("NOT_REGISTERED", 403);
      // Recheck applicant eligibility through M002's public projection before the transaction.
      let candidateEligible = true;
      if (command.action === "approve") {
        const [candidate] = await db
          .select()
          .from(teamApplications)
          .where(
            and(
              eq(teamApplications.id, uuid(command.applicationId)),
              eq(teamApplications.eventId, eventId),
            ),
          );
        candidateEligible =
          !!candidate &&
          !!(await participation.getRegisteredParticipant(candidate.userId));
      }
      await db.transaction(async (tx) => {
        if (configReader) {
          const latest = await configReader(tx);
          if (!latest) throw new CenterError("NOT_FOUND", 404);
          config = centerConfig(latest);
        }
        const now = new Date();
        if (!centerOpen(config, now))
          throw new CenterError(
            now.getTime() < Date.parse(config.opensAt) ? "NOT_OPEN" : "CLOSED",
            403,
          );
        const data = await rows(tx);
        const mine = data.members.find((m) => m.userId === user.id);
        const pending = data.applications.find(
          (a) =>
            a.userId === user.id &&
            applicationDto(a, data.teams, data.members, now).status ===
              "pending",
        );
        const free = () => {
          if (mine) throw new CenterError("ALREADY_MEMBER");
          if (pending) throw new CenterError("PENDING_APPLICATION");
        };
        const loadTeam = (id: string) => {
          uuid(id);
          const team = data.teams.find((t) => t.id === id && !t.dissolved);
          if (!team) throw new CenterError("NOT_FOUND", 404);
          return team;
        };
        const checkRevision = (team: Team) => {
          if (
            !("revision" in command) ||
            !Number.isInteger(command.revision) ||
            command.revision !== team.revision
          )
            throw new CenterError("REVISION_CONFLICT");
        };
        const captain = (team: Team) => {
          if (team.captainId !== user.id)
            throw new CenterError("FORBIDDEN", 403);
          checkRevision(team);
        };
        const bump = async (
          team: Team,
          values: Partial<typeof eventTeams.$inferInsert> = {},
        ) => {
          await tx
            .update(eventTeams)
            .set({ ...values, revision: team.revision + 1 })
            .where(scopedTeam(team.id));
        };
        const expire = async (
          teamId: string,
          reason: string,
          except?: string,
        ) => {
          await tx
            .update(teamApplications)
            .set({ status: "expired", reason })
            .where(
              and(
                eq(teamApplications.eventId, eventId),
                eq(teamApplications.teamId, teamId),
                eq(teamApplications.status, "pending"),
                except ? ne(teamApplications.id, except) : undefined,
              ),
            );
        };
        switch (command.action) {
          case "create": {
            free();
            const values = input(command.input);
            const [team] = await tx
              .insert(eventTeams)
              .values({ ...values, eventId, captainId: user.id })
              .returning();
            await tx
              .insert(teamMembers)
              .values({ eventId, teamId: team.id, userId: user.id, ...reg });
            break;
          }
          case "apply": {
            free();
            const team = loadTeam(command.teamId);
            if (card(team, data.members, now).stage !== "recruiting")
              throw new CenterError("NOT_RECRUITING");
            await tx.insert(teamApplications).values({
              eventId,
              teamId: team.id,
              userId: user.id,
              ...reg,
              skills: text(command.skills, 300),
              message: text(command.message, 1000),
            });
            break;
          }
          case "withdraw": {
            uuid(command.applicationId);
            const a = data.applications.find(
              (a) => a.id === command.applicationId && a.userId === user.id,
            );
            if (!a) throw new CenterError("NOT_FOUND", 404);
            if (
              applicationDto(a, data.teams, data.members, now).status !==
              "pending"
            )
              throw new CenterError("APPLICATION_CHANGED");
            await tx
              .update(teamApplications)
              .set({ status: "withdrawn" })
              .where(eq(teamApplications.id, a.id));
            break;
          }
          case "approve":
          case "reject": {
            const team = loadTeam(command.teamId);
            captain(team);
            uuid(command.applicationId);
            const a = data.applications.find(
              (a) => a.id === command.applicationId && a.teamId === team.id,
            );
            if (!a) throw new CenterError("NOT_FOUND", 404);
            if (
              applicationDto(a, data.teams, data.members, now).status !==
              "pending"
            )
              throw new CenterError("APPLICATION_CHANGED");
            if (command.action === "approve") {
              if (!candidateEligible)
                throw new CenterError("NOT_REGISTERED", 403);
              if (data.members.some((m) => m.userId === a.userId))
                throw new CenterError("ALREADY_MEMBER");
              const count = data.members.filter(
                (m) => m.teamId === team.id,
              ).length;
              if (count >= team.capacity) throw new CenterError("FULL");
              await tx.insert(teamMembers).values({
                eventId,
                teamId: team.id,
                userId: a.userId,
                displayName: a.displayName,
                role: a.role,
              });
              await tx
                .update(teamApplications)
                .set({ status: "accepted" })
                .where(eq(teamApplications.id, a.id));
              if (count + 1 >= team.capacity)
                await expire(team.id, "FULL", a.id);
            } else
              await tx
                .update(teamApplications)
                .set({ status: "rejected" })
                .where(eq(teamApplications.id, a.id));
            await bump(team);
            break;
          }
          case "edit": {
            const team = loadTeam(command.teamId);
            captain(team);
            const values = input(command.input);
            if (typeof command.recruiting !== "boolean")
              throw new CenterError("INVALID_INPUT", 400);
            const count = data.members.filter(
              (m) => m.teamId === team.id,
            ).length;
            if (values.capacity < count)
              throw new CenterError("CAPACITY_TOO_SMALL");
            await bump(team, { ...values, recruiting: command.recruiting });
            if (values.capacity === count) await expire(team.id, "FULL");
            break;
          }
          case "leave":
          case "remove":
          case "transfer":
          case "dissolve": {
            const team = loadTeam(command.teamId);
            if (command.action === "leave") {
              if (!mine || mine.teamId !== team.id)
                throw new CenterError("FORBIDDEN", 403);
              checkRevision(team);
              if (team.captainId === user.id)
                throw new CenterError("TRANSFER_FIRST");
              await tx.delete(teamMembers).where(eq(teamMembers.id, mine.id));
              await bump(team);
              break;
            }
            captain(team);
            if (command.action === "dissolve") {
              await tx
                .delete(teamMembers)
                .where(
                  and(
                    eq(teamMembers.eventId, eventId),
                    eq(teamMembers.teamId, team.id),
                  ),
                );
              await expire(team.id, "DISSOLVED");
              await bump(team, { dissolved: true, recruiting: false });
              break;
            }
            if (!("userId" in command))
              throw new CenterError("INVALID_INPUT", 400);
            const targetId = uuid(command.userId);
            const target = data.members.find(
              (m) => m.teamId === team.id && m.userId === targetId,
            );
            if (!target || target.userId === user.id)
              throw new CenterError("INVALID_INPUT", 400);
            if (command.action === "transfer")
              await bump(team, { captainId: target.userId });
            else {
              await tx.delete(teamMembers).where(eq(teamMembers.id, target.id));
              await bump(team);
            }
            break;
          }
          default:
            throw new CenterError("INVALID_INPUT", 400);
        }
      });
    });
    return get(user);
  }
  return { list, get, execute };
}
