"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ParticipationDto } from "@/modules/event-participation/contracts";
import {
  EventShell,
  dateText,
  useEventText,
} from "@/modules/event-participation/components/shared";
import { centerText } from "../i18n";
import { centerRequest } from "../client";
import type { CenterDto } from "../contracts";
const safeLink = (v: string) =>
  (v.startsWith("/") && !v.startsWith("//") && !/[\\\s]/.test(v)) ||
  /^https:\/\/[^\s]+$/.test(v);
export function ParticipantHub({
  signedIn,
  participation,
  serverNow,
  center,
  preview = false,
}: {
  signedIn: boolean;
  participation: ParticipationDto | null;
  serverNow: string;
  center: CenterDto | null;
  preview?: boolean;
}) {
  const {
      language,
      t: et,
      eventConfig,
      pageBase,
      eventRequest,
    } = useEventText(),
    t = centerText[language];
  const [me, setMe] = useState(participation),
    [team, setTeam] = useState(center),
    [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(
      () => setElapsed(performance.now() - start),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!signedIn || preview) return;
    let live = true;
    const reload = () =>
      void Promise.all([
        eventRequest<ParticipationDto>("/participation"),
        centerRequest(eventConfig.id).me(),
      ])
        .then(([p, c]) => {
          if (live) {
            setMe(p);
            setTeam(c);
          }
        })
        .catch(() => {});
    const timer = setInterval(reload, 30000);
    window.addEventListener("focus", reload);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
    // EventProvider binds the client to the current activity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, eventConfig.id, preview]);
  const now = Date.parse(serverNow) + elapsed;
  const submissionOpen =
    now >= Date.parse(eventConfig.submissionOpensAt) &&
    now < Date.parse(eventConfig.submissionClosesAt);
  let action = t.view,
    href = pageBase + "/materials",
    hint = "";
  if (!signedIn) {
    action = t.loginJoin;
    href = "/login?next=" + encodeURIComponent(pageBase);
    hint = eventConfig.introduction[language];
  } else if (!me?.registration) {
    href = pageBase + "/register";
    if (now < Date.parse(eventConfig.registrationOpensAt)) {
      action = t.registrationNotOpen;
      hint = dateText(
        eventConfig.registrationOpensAt,
        language,
        eventConfig.timeZone,
      );
    } else if (now >= Date.parse(eventConfig.registrationClosesAt)) {
      action = t.registrationClosed;
    } else action = t.start;
  } else if (now < Date.parse(eventConfig.submissionOpensAt)) {
    action = t.notOpen;
    hint = dateText(
      eventConfig.submissionOpensAt,
      language,
      eventConfig.timeZone,
    );
  } else if (me.canEdit && submissionOpen) {
    if (me.reviewStatus === "rejected" || me.status === "needs_changes")
      action = t.supplement;
    else if (me.hasDraft) action = t.continue;
    else if (me.status === "not_submitted") action = t.submit;
  }
  const regDeadline =
    now < Date.parse(eventConfig.registrationClosesAt) && !me?.registration;
  const deadline = regDeadline
    ? eventConfig.registrationClosesAt
    : eventConfig.submissionClosesAt;
  const duration = Math.max(0, Date.parse(deadline) - now);
  const settings = eventConfig.participantCenter;
  const resources = settings?.resources?.filter((r) => safeLink(r.url)) ?? [];
  const community =
    settings?.communityUrl && safeLink(settings.communityUrl)
      ? settings.communityUrl
      : null;
  return (
    <EventShell signedIn={signedIn}>
      <section className="pc-banner">
        <span className="eyebrow">{t.lobby} / PARTICIPANT HUB</span>
        <h1>{eventConfig.name[language]}</h1>
        <p>{eventConfig.introduction[language]}</p>
        <p>
          {dateText(eventConfig.startsAt, language, eventConfig.timeZone)} —{" "}
          {dateText(eventConfig.endsAt, language, eventConfig.timeZone)} ·{" "}
          {eventConfig.location[language]}
        </p>
      </section>
      <section
        className="pc-deadline"
        aria-label={regDeadline ? t.registrationDeadline : t.submissionDeadline}
      >
        <span>
          {duration
            ? regDeadline
              ? t.registrationDeadline
              : t.submissionDeadline
            : t.ended}
        </span>
        {duration > 0 && (
          <strong>
            {Math.floor(duration / 86400000)}
            {language === "zh" ? "天" : "d"}{" "}
            {Math.floor(duration / 3600000) % 24}
            {language === "zh" ? "时" : "h"} {Math.floor(duration / 60000) % 60}
            {language === "zh" ? "分" : "m"}
          </strong>
        )}
        <small>
          {dateText(deadline, language, eventConfig.timeZone)} ·{" "}
          {eventConfig.timeZone}
        </small>
      </section>
      <section aria-label={t.progress} className="pc-progress">
        <div>
          {t.registration}
          <strong>{me?.registration ? t.registered : t.notRegistered}</strong>
        </div>
        <div>
          {t.mine}
          <strong>{team?.team?.name ?? t.notJoined}</strong>
          {team?.isCaptain && (
            <Link href={pageBase + "/my-team"}>
              {t.incoming} ({team.incoming.length})
            </Link>
          )}
        </div>
        <div>
          {t.materials}
          <strong>
            {me?.reviewStatus === "approved"
              ? language === "zh"
                ? "通过"
                : "Approved"
              : me?.reviewStatus === "rejected"
                ? language === "zh"
                  ? "驳回"
                  : "Rejected"
                : et[me?.status ?? "not_submitted"]}
          </strong>
        </div>
      </section>
      <section className="ev-panel pc-next">
        <div>
          <h2>{t.next}</h2>
          <p>{hint || t.policy}</p>
        </div>
        <Link className="button primary" href={href}>
          {action} →
        </Link>
      </section>
      <nav
        className="pc-shortcuts"
        aria-label={language === "zh" ? "快捷入口" : "Quick links"}
      >
        <Link href={pageBase + "/register"}>
          {me?.registration ? t.viewRegistration : t.start} ↗
        </Link>
        <Link href={pageBase + "/materials"}>{t.materials} ↗</Link>
        <Link href={pageBase + "/teams"}>{t.find} ↗</Link>
        {!!resources.length && <a href="#resources">{t.resources} ↓</a>}
      </nav>
      <div className="ev-two-columns">
        <section className="ev-panel">
          <h2>{t.schedule}</h2>
          <dl>
            <dt>{et.registrationTime}</dt>
            <dd>
              {dateText(
                eventConfig.registrationOpensAt,
                language,
                eventConfig.timeZone,
              )}{" "}
              —{" "}
              {dateText(
                eventConfig.registrationClosesAt,
                language,
                eventConfig.timeZone,
              )}
            </dd>
            <dt>{et.submissionTime}</dt>
            <dd>
              {dateText(
                eventConfig.submissionOpensAt,
                language,
                eventConfig.timeZone,
              )}{" "}
              —{" "}
              {dateText(
                eventConfig.submissionClosesAt,
                language,
                eventConfig.timeZone,
              )}
            </dd>
          </dl>
          <p className="pc-muted">{eventConfig.timeZone}</p>
        </section>
        <section id="rules" className="ev-panel pc-resources">
          <h2>{t.rules}</h2>
          <ol className="ev-rules">
            {eventConfig.rules[language].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="pc-muted">{t.policy}</p>
        </section>
      </div>
      {!!resources.length && (
        <section id="resources" className="ev-panel pc-resources">
          <h2>{t.resources}</h2>
          {resources.map((r) => (
            <p key={r.url}>
              <a
                href={r.url}
                target={r.url.startsWith("https:") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {r.title[language]} ↗
              </a>
            </p>
          ))}
        </section>
      )}
      {!!settings?.faq?.length && (
        <section id="faq" className="ev-panel pc-resources">
          <h2>{t.faq}</h2>
          {settings.faq.map((v, i) => (
            <details key={i}>
              <summary>{v.question[language]}</summary>
              <p>{v.answer[language]}</p>
            </details>
          ))}
        </section>
      )}
      {community && (
        <section className="ev-panel">
          <a
            className="button"
            href={community}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.community} ↗
          </a>
        </section>
      )}
    </EventShell>
  );
}
