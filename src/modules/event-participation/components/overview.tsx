"use client";
import Link from "next/link";
import type { ParticipationDto } from "../contracts";
import { dateText, EventCountdown, EventShell, useEventText } from "./shared";
export function EventOverview({
  signedIn,
  participation,
  serverNow,
}: {
  signedIn: boolean;
  participation: ParticipationDto | null;
  serverNow: string;
}) {
  const { language, t, eventConfig, pageBase } = useEventText();
  return (
    <EventShell signedIn={signedIn}>
      <section className="ev-hero">
        <div>
          <div className="eyebrow purple-text">CREATE / SUBMIT / CONNECT</div>
          <h1>{eventConfig.name[language]}</h1>
          <p className="ev-lead">{eventConfig.introduction[language]}</p>
          <p className="ev-location">◉ {eventConfig.location[language]}</p>
          <Link
            className="button primary"
            href={
              !signedIn
                ? "/login?next=" + encodeURIComponent(pageBase + "/register")
                : participation?.registration
                  ? pageBase + "/materials"
                  : pageBase + "/register"
            }
          >
            {!signedIn
              ? t.login
              : participation?.registration
                ? t.registered
                : t.registerNow}{" "}
            ↗
          </Link>
        </div>
        <div className="ev-hero-art" aria-hidden="true">
          <span>✳</span>
          <small>BUILD SOMETHING / DEMO</small>
        </div>
      </section>
      <EventCountdown serverNow={serverNow} />
      <div className="ev-two-columns">
        <section className="ev-panel">
          <h2>{t.schedule}</h2>
          {"startsAt" in eventConfig && (
            <dl>
              <dt>{language === "zh" ? "活动起止时间" : "Event dates"}</dt>
              <dd>
                {dateText(eventConfig.startsAt, language, eventConfig.timeZone)}
                <br />—{" "}
                {dateText(eventConfig.endsAt, language, eventConfig.timeZone)}
              </dd>
            </dl>
          )}
          <dl>
            <dt>{t.registrationTime}</dt>
            <dd>
              {dateText(
                eventConfig.registrationOpensAt,
                language,
                eventConfig.timeZone,
              )}
              <br />—{" "}
              {dateText(
                eventConfig.registrationClosesAt,
                language,
                eventConfig.timeZone,
              )}
            </dd>
            <dt>{t.submissionTime}</dt>
            <dd>
              {dateText(
                eventConfig.submissionOpensAt,
                language,
                eventConfig.timeZone,
              )}
              <br />—{" "}
              {dateText(
                eventConfig.submissionClosesAt,
                language,
                eventConfig.timeZone,
              )}
            </dd>
          </dl>
          <p className="ev-help">
            {t.timezone} {eventConfig.timeZone}
          </p>
        </section>
        <section className="ev-panel">
          <h2>{t.rules}</h2>
          <ol className="ev-rules">
            {eventConfig.rules[language].map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          <p className="ev-help">
            {eventConfig.tracks
              .map((track) => track.name[language])
              .join(" / ")}
          </p>
        </section>
      </div>
    </EventShell>
  );
}
