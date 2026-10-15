"use client";
import Link from "next/link";
import Image from "next/image";
import { createContext, useContext, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
import { CenterNavigation } from "@/modules/participant-center/components/navigation";
import "@/modules/participant-center/styles.css";
import { eventConfig as defaultConfig } from "../config";
import type { EventDefinition } from "@/modules/event-board/contracts";
import { eventMessages, eventErrors } from "../i18n";
import { EventApiError, createEventRequest } from "../client";
import type { AssetDto, MaterialPayload, MaterialsDto } from "../contracts";
const EventContext = createContext<EventDefinition | typeof defaultConfig>(
  defaultConfig,
);
export function EventProvider({
  config,
  children,
}: {
  config: EventDefinition;
  children: React.ReactNode;
}) {
  return (
    <EventContext.Provider value={config}>{children}</EventContext.Provider>
  );
}
export function useEventText() {
  const { language } = useLanguage();
  const eventConfig = useContext(EventContext);
  const pageBase = "/events/" + encodeURIComponent(eventConfig.id);
  return {
    language,
    t: eventMessages[language],
    eventConfig,
    pageBase,
    reviewBase: "/review/events/" + encodeURIComponent(eventConfig.id),
    eventRequest: createEventRequest(eventConfig.id),
  };
}
export function errorText(error: unknown, language: "zh" | "en") {
  if (error instanceof EventApiError) {
    return (
      eventErrors[error.code]?.[language] ??
      (language === "zh"
        ? `操作失败（${error.code}），请刷新状态后重试。`
        : `Request failed (${error.code}). Refresh your status and try again.`)
    );
  }
  return eventMessages[language].network;
}
export function dateText(
  value: string,
  language: "zh" | "en",
  timeZone = defaultConfig.timeZone as string,
) {
  return new Date(value).toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function EventShell({
  children,
  signedIn = false,
  review = false,
  onNavigate,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  review?: boolean;
  onNavigate?: () => boolean;
}) {
  const { t, eventConfig, pageBase, reviewBase, language } = useEventText();
  return (
    <div
      className="site event-module"
      onClickCapture={(event) => {
        if (
          !onNavigate ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const target = event.target;
        const anchor = target instanceof Element ? target.closest("a") : null;
        if (
          !anchor ||
          (anchor.target && anchor.target !== "_self") ||
          anchor.hasAttribute("download") ||
          !anchor.href ||
          anchor.href === window.location.href
        )
          return;
        if (!onNavigate()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <Header signedIn={signedIn} />
      <div className={review ? "" : "pc-workspace"}>
        {!review && (
          <CenterNavigation
            base={pageBase}
            language={language}
            name={eventConfig.name[language]}
            resources={!!eventConfig.participantCenter?.resources?.length}
            faq={!!eventConfig.participantCenter?.faq?.length}
          />
        )}
        <main className="ev-main">
          {eventConfig.demo && <div className="ev-demo">{t.demo}</div>}
          {review && (
            <nav className="ev-nav">
              <Link href="/events">
                ← {language === "zh" ? "返回活动展板" : "Back to event board"}
              </Link>
              <Link href={pageBase}>{t.home}</Link>
              <Link href={pageBase + "/register"}>{t.register}</Link>
              <Link href={pageBase + "/materials"}>{t.materials}</Link>
              {review && <Link href={reviewBase}>{t.review}</Link>}
            </nav>
          )}
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
export function EventCountdown({ serverNow }: { serverNow: string }) {
  const { t, eventConfig } = useEventText();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - start), 1000);
    return () => clearInterval(id);
  }, []);
  const now = Date.parse(serverNow) + elapsed;
  const duration = Date.parse(eventConfig.submissionClosesAt) - now;
  if (now < Date.parse(eventConfig.submissionOpensAt))
    return <p className="ev-countdown">{t.notOpen}</p>;
  if (duration <= 0) return <p className="ev-countdown">{t.closed}</p>;
  return (
    <p className="ev-countdown">
      {t.remaining}
      <strong>
        {Math.floor(duration / 86400000)}
        {t.days} {Math.floor(duration / 3600000) % 24}
        {t.hours} {Math.floor(duration / 60000) % 60}
        {t.minutes}
      </strong>
    </p>
  );
}
export function Status({
  data,
}: {
  data: Pick<
    MaterialsDto,
    "status" | "result" | "revision" | "submittedRevision"
  > & { draft?: MaterialPayload | null };
}) {
  const { t, language } = useEventText();
  return (
    <div className="ev-status-row">
      <span className="ev-badge">
        {data.status === "processed" && data.result
          ? data.result === "accepted"
            ? language === "zh"
              ? "通过"
              : "Approved"
            : language === "zh"
              ? "驳回"
              : "Rejected"
          : data.status === "needs_changes"
            ? language === "zh"
              ? "驳回（需补充）"
              : "Rejected (changes requested)"
            : t[data.status]}
      </span>
      {data.draft !== undefined && (
        <span className="ev-badge muted">
          {data.draft ? t.hasDraft : t.noDraft}
        </span>
      )}
      <small>
        {t.revision}: {data.revision} / {t.submittedRevision}:{" "}
        {data.submittedRevision}
      </small>
    </div>
  );
}
export function AssetLinks({
  ids,
  assets,
}: {
  ids: (string | null)[];
  assets: AssetDto[];
}) {
  return (
    <ul className="ev-files">
      {ids.filter(Boolean).map((id) => {
        const file = assets.find((a) => a.id === id);
        return file ? (
          <li key={id}>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              {file.originalName} ↗
            </a>
            <small>{Math.ceil(file.size / 1024)} KB</small>
          </li>
        ) : (
          <li key={id}>{id}</li>
        );
      })}
    </ul>
  );
}
export function MaterialPreview({
  payload,
  assets,
}: {
  payload: MaterialPayload;
  assets: AssetDto[];
}) {
  const { language, t, eventConfig } = useEventText();
  const cover = assets.find((a) => a.id === payload.coverId);
  return (
    <div className="ev-preview">
      {cover && (
        <a href={cover.url} target="_blank" rel="noopener noreferrer">
          <Image
            unoptimized
            width={1200}
            height={675}
            className="ev-cover"
            src={cover.url}
            alt={t.cover}
          />
        </a>
      )}
      <h3>{payload.name || t.untitled}</h3>
      <p>{payload.tagline}</p>
      <dl>
        <dt>{t.track}</dt>
        <dd>
          {eventConfig.tracks.find((track) => track.id === payload.trackId)
            ?.name[language] ?? payload.trackId}
        </dd>
        <dt>{t.description}</dt>
        <dd className="ev-prewrap">{payload.description || "—"}</dd>
      </dl>
      <AssetLinks
        ids={[payload.coverId, ...payload.screenshotIds, payload.documentId]}
        assets={assets}
      />
      {(
        [
          ["videoUrl", t.video],
          ["experienceUrl", t.experience],
          ["codeUrl", t.code],
        ] as const
      ).map(
        ([key, label]) =>
          payload[key] && (
            <p key={key} className="ev-url">
              <span>{label}</span>
              <a href={payload[key]} target="_blank" rel="noopener noreferrer">
                {payload[key]} ↗
              </a>
            </p>
          ),
      )}
      <p className="ev-declarations">
        {t.declarations}: {t.original} {payload.original ? t.yes : t.no}
        <br />
        {t.usage} {payload.usageAuthorized ? t.yes : t.no}
        <br />
        {t.publication}: {payload.publicDisplay ? t.yes : t.no}
      </p>
    </div>
  );
}
