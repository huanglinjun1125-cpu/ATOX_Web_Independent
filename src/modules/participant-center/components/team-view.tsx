"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EventShell,
  dateText,
  useEventText,
} from "@/modules/event-participation/components/shared";
import { roleLabels } from "@/modules/event-participation/i18n";
import { EventApiError } from "@/modules/event-participation/client";
import { centerText, centerErrors } from "../i18n";
import { centerRequest } from "../client";
import { centerConfig } from "../config";
import { CenterDialog } from "./dialog";
import type { CenterDto, TeamCard, TeamInput, TeamCommand } from "../contracts";
type Mode = "teams" | "my-team" | "applications";
type Modal =
  | { kind: "create" }
  | { kind: "edit"; team: TeamCard }
  | { kind: "apply"; team: TeamCard }
  | { kind: "confirm"; title: string; command: TeamCommand };
export function TeamView({
  mode,
  signedIn,
  initial,
  initialTeams,
  intent,
}: {
  mode: Mode;
  signedIn: boolean;
  initial: CenterDto | null;
  initialTeams: TeamCard[];
  intent?: string;
}) {
  const { language, eventConfig, pageBase } = useEventText(),
    t = centerText[language];
  const cfg = centerConfig(eventConfig);
  const [data, setData] = useState(initial),
    [teams, setTeams] = useState(initialTeams);
  const [q, setQ] = useState(""),
    [track, setTrack] = useState(""),
    [vacancies, setVacancies] = useState(""),
    [stage, setStage] = useState("recruiting");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal | null>(() =>
    initial?.canManage &&
    !initial.team &&
    !initial.applications.some((a) => a.status === "pending")
      ? intent === "create"
        ? { kind: "create" }
        : initialTeams.some((t) => t.id === intent && t.stage === "recruiting")
          ? { kind: "apply", team: initialTeams.find((t) => t.id === intent)! }
          : null
      : null,
  );
  const request = centerRequest(eventConfig.id);
  function report(err: unknown) {
    const code = err instanceof EventApiError ? err.code : "";
    return (
      centerErrors[code]?.[language === "zh" ? 0 : 1] ??
      (language === "zh"
        ? "操作失败，请稍后重试。"
        : "Unable to complete the request. Try again.")
    );
  }
  async function refresh() {
    try {
      const [list, me] = await Promise.all([
        request.list(),
        signedIn ? request.me() : Promise.resolve(null),
      ]);
      setTeams(list.teams);
      setData(me);
    } catch (err) {
      setError(report(err));
    }
  }
  useEffect(() => {
    let active = true;
    const reload = () => {
      const api = centerRequest(eventConfig.id);
      void Promise.all([
        api.list(),
        signedIn ? api.me() : Promise.resolve(null),
      ])
        .then(([list, me]) => {
          if (active) {
            setTeams(list.teams);
            setData(me);
          }
        })
        .catch(() => {});
    };
    const timer = setInterval(reload, 30000);
    window.addEventListener("focus", reload);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
  }, [eventConfig.id, signedIn]);
  useEffect(() => {
    if (intent) {
      const url = new URL(window.location.href);
      url.searchParams.delete("intent");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [intent]);
  const pending = data?.applications.some((a) => a.status === "pending");
  const eligible = !!data?.canManage && !data.team && !pending;
  const mine = data?.team;
  function start(kind: "create" | "apply", team?: TeamCard) {
    setError("");
    setNotice("");
    setModal(kind === "create" ? { kind } : { kind, team: team! });
  }
  function destination(action: string) {
    const next = pageBase + "/teams?intent=" + encodeURIComponent(action);
    const register = pageBase + "/register?next=" + encodeURIComponent(next);
    return signedIn ? register : "/login?next=" + encodeURIComponent(register);
  }
  async function run(command: TeamCommand) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await request.command(command);
      setData(updated);
      setModal(null);
      setNotice(t.successful);
      // A failed list refresh must not turn an already committed write into a
      // misleading failure or invite a duplicate submission.
      try {
        setTeams((await request.list()).teams);
      } catch {
        // The next refresh/focus will retry; committed personal state is current.
      }
    } catch (err) {
      setError(report(err));
    } finally {
      setBusy(false);
    }
  }
  const confirm = (title: string, command: TeamCommand) => {
    setError("");
    setModal({ kind: "confirm", title, command });
  };
  const filtered = teams.filter(
    (team) =>
      (!q ||
        [team.name, team.description, team.recruitment]
          .join(" ")
          .toLowerCase()
          .includes(q.trim().toLowerCase())) &&
      (!track || team.trackId === track) &&
      (!vacancies || team.vacancies === Number(vacancies)) &&
      (!stage || team.stage === stage),
  );
  function joinButton(team: TeamCard) {
    if (team.stage !== "recruiting")
      return <span className="ev-badge">{t[team.stage]}</span>;
    if (!signedIn || !data?.registered)
      return (
        <Link className="button" href={destination(team.id)}>
          {t.apply}
        </Link>
      );
    if (data.team) return <Link href={pageBase + "/my-team"}>{t.mine} →</Link>;
    if (pending)
      return <Link href={pageBase + "/applications"}>{t.applications} →</Link>;
    return (
      <button
        className="button primary"
        disabled={!eligible}
        onClick={() => start("apply", team)}
      >
        {t.apply}
      </button>
    );
  }
  return (
    <EventShell signedIn={signedIn}>
      <div className="pc-title-row">
        <h1>
          {mode === "teams"
            ? t.teams
            : mode === "my-team"
              ? t.mine
              : t.applications}
        </h1>
        <button
          className="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {t.refresh}
        </button>
      </div>
      <p className="ev-lead">{t.policy}</p>
      <p className="pc-muted">{t.privacy}</p>
      <p className="pc-muted">
        {t.window}: {dateText(cfg.opensAt, language, eventConfig.timeZone)} —{" "}
        {dateText(cfg.closesAt, language, eventConfig.timeZone)} (
        {eventConfig.timeZone})
      </p>
      {data && !data.canManage && (
        <p className="ev-notice">
          {data.registered ? (
            t.closedHint
          ) : (
            <Link href={pageBase + "/register"}>{t.register}</Link>
          )}
        </p>
      )}
      {notice && (
        <p role="status" className="ev-notice">
          {notice}
        </p>
      )}
      {error && !modal && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {mode === "teams" && (
        <>
          <div className="pc-actions">
            {!signedIn || !data?.registered ? (
              <Link className="button primary" href={destination("create")}>
                {t.create}
              </Link>
            ) : data.team ? (
              <Link className="button primary" href={pageBase + "/my-team"}>
                {t.mine}
              </Link>
            ) : (
              <button
                className="button primary"
                disabled={!eligible}
                onClick={() => start("create")}
              >
                {t.create}
              </button>
            )}
          </div>
          {pending && (
            <p className="ev-notice">
              <Link href={pageBase + "/applications"}>{t.pendingHint}</Link>
            </p>
          )}
          <div className="pc-filters">
            <label>
              {t.search}
              <input
                value={q}
                maxLength={200}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label>
              {t.track}
              <select value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="">{t.all}</option>
                {eventConfig.tracks.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name[language]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.vacancies}
              <select
                value={vacancies}
                onChange={(e) => setVacancies(e.target.value)}
              >
                <option value="">{t.all}</option>
                {Array.from({ length: cfg.maxSize - 1 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.stage}
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="recruiting">{t.recruiting}</option>
                <option value="">{t.all}</option>
              </select>
            </label>
            <button
              className="button"
              onClick={() => {
                setQ("");
                setTrack("");
                setVacancies("");
                setStage("");
              }}
            >
              {t.clear}
            </button>
          </div>
          <p className="pc-muted" aria-live="polite">
            {filtered.length} {t.count}
          </p>
          <div className="pc-team-grid">
            {filtered.map((team) => (
              <article className="ev-panel pc-team-card" key={team.id}>
                <div className="pc-avatar" aria-hidden="true">
                  {team.name.slice(0, 1)}
                </div>
                <h2>{team.name}</h2>
                <p className="pc-muted">
                  {t.captain}: {team.captainName}
                </p>
                <p>{team.description}</p>
                <p className="ev-badge">
                  {
                    eventConfig.tracks.find((v) => v.id === team.trackId)?.name[
                      language
                    ]
                  }
                </p>
                <p>
                  <strong>{t.skills}</strong> · {team.skills}
                </p>
                <p>{team.recruitment}</p>
                <p>
                  {team.count}/{team.capacity} · {t.vacancies} {team.vacancies}
                </p>
                {joinButton(team)}
              </article>
            ))}
          </div>
          {!filtered.length && <p className="ev-panel">{t.noTeams}</p>}
        </>
      )}
      {mode === "my-team" &&
        (mine ? (
          <>
            <section className="ev-panel">
              <div className="pc-title-row">
                <h2>{mine.name}</h2>
                <span className="ev-badge">{t[mine.stage]}</span>
              </div>
              <p>{mine.description}</p>
              <p>
                {
                  eventConfig.tracks.find((v) => v.id === mine.trackId)?.name[
                    language
                  ]
                }{" "}
                · {mine.count}/{mine.capacity} ·{" "}
                {mine.count < (data?.minSize ?? 2) ? t.forming : t.ready}
              </p>
              <p>{mine.skills}</p>
              <p>{mine.recruitment}</p>
              <h3>{t.members}</h3>
              {mine.members.map((m) => (
                <div className="pc-member" key={m.userId}>
                  <span>
                    {m.displayName} · {roleLabels[language][m.role]} ·{" "}
                    {m.captain ? t.captain : t.member}
                  </span>
                  {data?.isCaptain && !m.captain && (
                    <div className="pc-actions">
                      <button
                        disabled={!data.canManage || busy}
                        onClick={() =>
                          confirm(t.transfer + " · " + m.displayName, {
                            action: "transfer",
                            teamId: mine.id,
                            revision: mine.revision,
                            userId: m.userId,
                          })
                        }
                      >
                        {t.transfer}
                      </button>
                      <button
                        disabled={!data.canManage || busy}
                        onClick={() =>
                          confirm(t.remove + " · " + m.displayName, {
                            action: "remove",
                            teamId: mine.id,
                            revision: mine.revision,
                            userId: m.userId,
                          })
                        }
                      >
                        {t.remove}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="pc-actions">
                {data?.isCaptain ? (
                  <>
                    <button
                      className="button"
                      disabled={!data.canManage || busy}
                      onClick={() => {
                        setError("");
                        setModal({ kind: "edit", team: mine });
                      }}
                    >
                      {t.edit}
                    </button>
                    <button
                      className="button"
                      disabled={!data.canManage || busy}
                      onClick={() =>
                        confirm(t.dissolve, {
                          action: "dissolve",
                          teamId: mine.id,
                          revision: mine.revision,
                        })
                      }
                    >
                      {t.dissolve}
                    </button>
                  </>
                ) : (
                  <button
                    className="button"
                    disabled={!data?.canManage || busy}
                    onClick={() =>
                      confirm(t.leave, {
                        action: "leave",
                        teamId: mine.id,
                        revision: mine.revision,
                      })
                    }
                  >
                    {t.leave}
                  </button>
                )}
              </div>
            </section>
            {data?.isCaptain && (
              <section className="ev-panel">
                <h2>
                  {t.incoming} ({data.incoming.length})
                </h2>
                {!data.incoming.length && <p>{t.noIncoming}</p>}
                {data.incoming.map((a) => (
                  <article className="pc-member" key={a.id}>
                    <div>
                      <h3>
                        {a.displayName} · {roleLabels[language][a.role]}
                      </h3>
                      <p>{a.skills}</p>
                      <p>{a.message}</p>
                    </div>
                    <div className="pc-actions">
                      <button
                        className="button primary"
                        disabled={!data.canManage || busy}
                        onClick={() =>
                          confirm(t.approve + " · " + a.displayName, {
                            action: "approve",
                            teamId: mine.id,
                            revision: mine.revision,
                            applicationId: a.id,
                          })
                        }
                      >
                        {t.approve}
                      </button>
                      <button
                        className="button"
                        disabled={!data.canManage || busy}
                        onClick={() =>
                          confirm(t.reject + " · " + a.displayName, {
                            action: "reject",
                            teamId: mine.id,
                            revision: mine.revision,
                            applicationId: a.id,
                          })
                        }
                      >
                        {t.reject}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        ) : (
          <section className="ev-panel">
            <p>{t.noTeam}</p>
            <Link className="button primary" href={pageBase + "/teams"}>
              {t.find}
            </Link>
          </section>
        ))}
      {mode === "applications" && (
        <section className="ev-panel">
          {!data?.applications.length && <p>{t.noApplications}</p>}
          {data?.applications.map((a) => (
            <article className="pc-member" key={a.id}>
              <div>
                <h2>{a.teamName}</h2>
                <span className="ev-badge">
                  {t[a.status]}
                  {a.status === "accepted" && !a.stillMember
                    ? " · " + t.left
                    : ""}
                </span>
                <p>{a.skills}</p>
                <p>{a.message}</p>
                <small>
                  {dateText(a.createdAt, language, eventConfig.timeZone)}
                </small>
                {a.reason && (
                  <p>
                    {a.reason === "FULL"
                      ? t.full
                      : a.reason === "DISSOLVED"
                        ? t.dissolved
                        : t.closed}
                  </p>
                )}
              </div>
              {a.status === "pending" && (
                <button
                  className="button"
                  disabled={!data.canManage || busy}
                  onClick={() =>
                    confirm(t.withdraw, {
                      action: "withdraw",
                      applicationId: a.id,
                    })
                  }
                >
                  {t.withdraw}
                </button>
              )}
              {a.stillMember && (
                <Link href={pageBase + "/my-team"}>{t.mine} →</Link>
              )}
            </article>
          ))}
        </section>
      )}
      {modal && (
        <CenterDialog
          title={
            modal.kind === "confirm"
              ? modal.title
              : modal.kind === "create"
                ? t.create
                : modal.kind === "edit"
                  ? t.edit
                  : t.apply + " · " + modal.team.name
          }
          close={() => setModal(null)}
          busy={busy}
        >
          {modal.kind === "confirm" ? (
            <>
              <p>{t.confirmHint}</p>
              <div className="pc-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void run(modal.command)}
                >
                  {busy ? t.busy : t.confirm}
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  {t.cancel}
                </button>
              </div>
            </>
          ) : modal.kind === "apply" ? (
            <form
              className="ev-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run({
                  action: "apply",
                  teamId: modal.team.id,
                  skills: String(form.get("skills")),
                  message: String(form.get("message")),
                });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  {t.personalSkills}
                  <input name="skills" required maxLength={300} />
                </label>
                <label>
                  {t.message}
                  <textarea name="message" required maxLength={1000} />
                </label>
                <button className="button primary" type="submit">
                  {busy ? t.busy : t.submitApplication}
                </button>
              </fieldset>
            </form>
          ) : (
            <form
              className="ev-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const input: TeamInput = {
                  name: String(f.get("name")),
                  description: String(f.get("description")),
                  trackId: String(f.get("trackId")),
                  skills: String(f.get("skills")),
                  recruitment: String(f.get("recruitment")),
                  capacity: Number(f.get("capacity")),
                };
                void run(
                  modal.kind === "create"
                    ? { action: "create", input }
                    : {
                        action: "edit",
                        input,
                        teamId: modal.team.id,
                        revision: modal.team.revision,
                        recruiting: f.get("recruiting") === "on",
                      },
                );
              }}
            >
              <fieldset disabled={busy}>
                {(
                  ["name", "description", "skills", "recruitment"] as const
                ).map((key) => (
                  <label key={key}>
                    {t[key]}
                    {key === "description" || key === "recruitment" ? (
                      <textarea
                        name={key}
                        required
                        maxLength={key === "description" ? 600 : 1000}
                        defaultValue={
                          modal.kind === "edit" ? modal.team[key] : ""
                        }
                      />
                    ) : (
                      <input
                        name={key}
                        required
                        maxLength={key === "name" ? 80 : 200}
                        defaultValue={
                          modal.kind === "edit" ? modal.team[key] : ""
                        }
                      />
                    )}
                  </label>
                ))}
                <div className="ev-form-grid">
                  <label>
                    {t.track}
                    <select
                      name="trackId"
                      defaultValue={
                        modal.kind === "edit"
                          ? modal.team.trackId
                          : eventConfig.tracks[0]?.id
                      }
                    >
                      {eventConfig.tracks.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name[language]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.capacity}
                    <input
                      type="number"
                      name="capacity"
                      required
                      min={cfg.minSize}
                      max={cfg.maxSize}
                      defaultValue={
                        modal.kind === "edit"
                          ? modal.team.capacity
                          : cfg.maxSize
                      }
                    />
                  </label>
                </div>
                {modal.kind === "edit" && (
                  <label className="ev-check">
                    <input
                      name="recruiting"
                      type="checkbox"
                      defaultChecked={modal.team.recruiting}
                    />
                    {t.recruiting}
                  </label>
                )}
                <button type="submit" className="button primary">
                  {busy ? t.busy : t.save}
                </button>
              </fieldset>
            </form>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </CenterDialog>
      )}
    </EventShell>
  );
}
