"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
import type { BoardCardDto, BoardDto } from "../contracts";
import { filterBoardEvents, getEventStage } from "../rules";
export interface BoardFilters {
  q?: string;
  year?: string;
  stage?: string;
}
const copy = {
  zh: {
    title: "活动",
    subtitle: "发现下一次创造的机会。",
    description: "探索活动，找到与你的好奇心同行的人。",
    search: "搜索活动",
    placeholder: "搜索活动名称或主题",
    year: "年份",
    allYears: "全部年份",
    stage: "活动阶段",
    allStages: "全部阶段",
    upcoming: "即将开始",
    ongoing: "进行中",
    ended: "已结束",
    reset: "重置筛选",
    recommend: "为你推荐",
    all: "全部活动",
    empty: "没有符合条件的活动",
    emptyHint: "试试其他关键词，或重置筛选查看全部活动。",
    count: "个活动",
    organizer: "主办方",
    time: "活动时间",
    location: "活动地点",
    view: "查看活动",
    external: "前往外部活动页面",
    unavailable: "即将开放",
    demo: "演示活动",
  },
  en: {
    title: "Events",
    subtitle: "Find your next reason to create.",
    description: "Explore events and meet people who share your curiosity.",
    search: "Search events",
    placeholder: "Search event names or themes",
    year: "Year",
    allYears: "All years",
    stage: "Event stage",
    allStages: "All stages",
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    ended: "Ended",
    reset: "Reset filters",
    recommend: "Recommended for you",
    all: "All events",
    empty: "No matching events",
    emptyHint: "Try another search, or reset filters to explore all events.",
    count: "events",
    organizer: "Organizer",
    time: "Event time",
    location: "Location",
    view: "View event",
    external: "Open external event page",
    unavailable: "Coming soon",
    demo: "Demo event",
  },
};
function targetInfo(target: string | null | undefined) {
  if (!target) return null;
  if (target.startsWith("/") && !target.startsWith("//"))
    return { href: target, external: false };
  try {
    const url = new URL(target);
    if (["https:"].includes(url.protocol))
      return { href: url.href, external: true };
  } catch {}
  return null;
}
export function EventCard({
  item,
  recommended = false,
}: {
  item: BoardCardDto;
  recommended?: boolean;
}) {
  const { language } = useLanguage();
  const t = copy[language];
  const event = item;
  const [coverFailed, setCoverFailed] = useState(false);
  const target = targetInfo(event.target);
  const href = target?.href;
  const starts = new Date(event.startsAt);
  const ends = new Date(event.endsAt);
  const date = (value: Date) =>
    value.toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
      timeZone: event.timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const content = (
    <>
      <div
        className={`eb-cover eb-cover-${event.id.includes("upcoming") ? "future" : event.id.includes("past") ? "past" : "current"}`}
      >
        {event.cover && !coverFailed ? (
          <Image
            unoptimized
            width={800}
            height={450}
            src={event.cover}
            alt=""
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <>
            <span aria-hidden="true">✳</span>
            <small>ATOX / {item.year}</small>
          </>
        )}
        <span className={"eb-stage eb-stage-" + item.stage}>
          {t[item.stage]}
        </span>
        {event.demo && <span className="eb-demo">{t.demo}</span>}
      </div>
      <div className="eb-card-body">
        <div className="eb-card-tags">
          <span>{item.year}</span>
          {event.tags.map((tag) => (
            <span key={tag.en}>{tag[language]}</span>
          ))}
        </div>
        <h3>{event.name[language]}</h3>
        <p className="eb-theme">{event.theme[language]}</p>
        <p className="eb-introduction">{event.introduction[language]}</p>
        <dl>
          <dt>{t.time}</dt>
          <dd>
            {date(starts)} — {date(ends)}
            <small>{event.timeZone}</small>
          </dd>
          <dt>{t.organizer}</dt>
          <dd>{event.organizer[language]}</dd>
          <dt>{t.location}</dt>
          <dd>{event.location[language]}</dd>
        </dl>
        <div className="eb-card-footer">
          <span>
            {!target ? t.unavailable : target.external ? t.external : t.view}
          </span>
          <span aria-hidden="true">↗</span>
        </div>
      </div>
    </>
  );
  return (
    <article className={recommended ? "eb-recommended" : "eb-card"}>
      {href ? (
        <Link
          className="eb-card-link"
          href={href}
          target={target?.external ? "_blank" : undefined}
          rel={target?.external ? "noopener noreferrer" : undefined}
        >
          {content}
        </Link>
      ) : (
        <div className="eb-card-link eb-disabled" aria-disabled="true">
          {content}
        </div>
      )}
    </article>
  );
}
export function BoardView({
  initial,
  signedIn = false,
  filters = {},
}: {
  initial: BoardDto;
  signedIn?: boolean;
  filters?: BoardFilters;
}) {
  const { language } = useLanguage();
  const t = copy[language];
  const [q, setQ] = useState(filters.q ?? "");
  const [active, setActive] = useState<BoardFilters>({
    ...filters,
    year: filters.year === "all" ? "" : filters.year,
    stage: filters.stage === "all" ? "" : filters.stage,
  });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(
      () => setElapsed(performance.now() - start),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  function commit(next: BoardFilters) {
    setActive(next);
    const params = new URLSearchParams();
    if (next.q?.trim()) params.set("q", next.q.trim());
    if (next.year) params.set("year", next.year);
    if (next.stage && next.stage !== "all") params.set("stage", next.stage);
    const href = "/events" + (params.size ? "?" + params : "");
    if (href !== window.location.pathname + window.location.search)
      window.history.pushState(null, "", href);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = q.trim();
      if (trimmed !== (active.q ?? "")) commit({ ...active, q: trimmed });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, active]);
  useEffect(() => {
    function restore() {
      const query = new URLSearchParams(window.location.search);
      const next = {
        q: query.get("q") ?? "",
        year: query.get("year") === "all" ? "" : (query.get("year") ?? ""),
        stage: query.get("stage") === "all" ? "" : (query.get("stage") ?? ""),
      };
      setQ(next.q);
      setActive(next);
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const now = new Date(Date.parse(initial.serverNow) + elapsed);
  const currentEvents = initial.events.map((item) => ({
    ...item,
    stage: getEventStage(item, now),
  }));
  const visible = filterBoardEvents(currentEvents, active);
  const years = [...new Set(initial.events.map((item) => item.year))].sort(
    (a, b) => b - a,
  );
  const unfiltered =
    !active.q?.trim() &&
    (!active.year || active.year === "all") &&
    (!active.stage || active.stage === "all");
  const recommended = unfiltered
    ? currentEvents.find(
        (item) =>
          item.recommended && item.stage !== "ended" && targetInfo(item.target),
      )
    : undefined;
  return (
    <div className="site event-board">
      <Header signedIn={signedIn} />
      <main className="eb-main">
        <section className="eb-heading">
          <span className="eb-eyebrow">EXPLORE / CONNECT / CREATE</span>
          <h1>
            {t.title}
            <span aria-hidden="true">✳</span>
          </h1>
          <h2>{t.subtitle}</h2>
          <p>{t.description}</p>
        </section>
        <form
          className="eb-filters"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <label className="eb-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label={t.search}
              placeholder={t.placeholder}
              value={q}
              maxLength={200}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <label>
            <span className="eb-sr-only">{t.year}</span>
            <select
              aria-label={t.year}
              value={active.year ?? ""}
              onChange={(event) =>
                commit({ ...active, q: q.trim(), year: event.target.value })
              }
            >
              <option value="">{t.allYears}</option>
              {years.map((year) => (
                <option value={year} key={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="eb-sr-only">{t.stage}</span>
            <select
              aria-label={t.stage}
              value={active.stage ?? ""}
              onChange={(event) =>
                commit({ ...active, q: q.trim(), stage: event.target.value })
              }
            >
              <option value="">{t.allStages}</option>
              {(["upcoming", "ongoing", "ended"] as const).map((stage) => (
                <option key={stage} value={stage}>
                  {t[stage]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setQ("");
              commit({});
            }}
          >
            {t.reset}
          </button>
        </form>
        {recommended && (
          <section className="eb-recommend-section">
            <h2>{t.recommend}</h2>
            <EventCard item={recommended} recommended />
          </section>
        )}
        <section aria-label={t.all}>
          <div className="eb-section-heading">
            <h2>{t.all}</h2>
            <span aria-live="polite">
              {visible.length} {t.count}
            </span>
          </div>
          {visible.length ? (
            <div className="eb-grid">
              {visible.map((item) => (
                <EventCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="eb-empty">
              <span aria-hidden="true">⌕</span>
              <h3>{t.empty}</h3>
              <p>{t.emptyHint}</p>
              <button
                onClick={() => {
                  setQ("");
                  commit({});
                }}
              >
                {t.reset} ↗
              </button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
