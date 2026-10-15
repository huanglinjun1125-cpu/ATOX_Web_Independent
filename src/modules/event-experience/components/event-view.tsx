"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Header } from "@/components/site-shell";
import { HomepageFooter } from "@/modules/homepage/components/navigation";
import { BrandMark, OrbitalArt, TrackIcon } from "@/components/brand-art";
import {
  malaysiaEvent as event,
  challengeTracks,
  proposedDays,
  eventFaq,
  safeInterestUrl,
  eventCalendar,
} from "../config";

const copy = {
  en: {
    planning: "PLANNING IN PROGRESS",
    eyebrow: "MALAYSIA / 2026",
    titleOne: "Build AI",
    titleTwo: "that matters.",
    tagline: "From real problems to working MVPs.",
    description:
      "Join a three-day build sprint where multidisciplinary teams turn meaningful challenges into working, testable MVPs.",
    register: "Register Interest",
    programme: "Explore the programme",
    when: "WHEN",
    where: "WHERE",
    format: "FORMAT",
    community: "COMMUNITY",
    date: "4–6 December 2026",
    venue: "Online + APU Campus",
    venueNote: "Kuala Lumpur · Campus venue pending approval",
    hybrid: "Three-day hybrid",
    hybridNote: "Online kick-off → Build day → Hybrid finals",
    estimate: "120–150 participants",
    estimateNote: "Planning estimate · MYT / UTC+8",
    aboutLabel: "01 / THE PURPOSE",
    aboutTitle: "A real problem.\nA working answer.",
    aboutBody:
      "For students, developers, designers, founders and problem-solvers from APU and the wider Malaysian ecosystem. Bring a different perspective. Build something people can actually try.",
    benefits: [
      {
        title: "Build with purpose.",
        body: "Begin with a user need. Turn an idea into a working prototype and test what it can do.",
      },
      {
        title: "Learn by making.",
        body: "The proposed programme includes mentor clinics, user testing and support for product, business and storytelling.",
      },
      {
        title: "Create connections.",
        body: "Find collaborators across disciplines. Share your work, your questions and the next step for your project.",
      },
    ],
    tracksLabel: "02 / CHALLENGE TRACKS",
    tracksTitle: "Where will you\nmake a difference?",
    tracksIntro:
      "Seven proposed areas. Choose a real user problem as your starting point. Final challenge statements are still under review.",
    trackDetail: "Explore this direction",
    trackStandard: "One shared standard.",
    trackStandardBody:
      "A real user problem. Responsible AI. A working, testable MVP.",
    journeyLabel: "03 / THE THREE-DAY JOURNEY",
    journeyTitle: "Connect. Build. Show.",
    journeyIntro:
      "One continuous journey, across online connection, campus collaboration and a hybrid final showcase.",
    agenda: "Explore the full agenda",
    allTimes:
      "All times in MYT / UTC+8. Proposed programme, subject to confirmation.",
    fridayNote:
      "Friday briefing: join live, or watch the recording and complete a short team check-in before Saturday morning.",
    calendar: "Add proposed dates to calendar",
    optionsLabel: "04 / PARTICIPATION",
    optionsTitle: "Different places.\nShared possibilities.",
    optionsIntro:
      "Choose a way to collaborate that works for your team. Campus activities remain subject to approval and booking.",
    onsite: "Build side by side.",
    online: "Connect from anywhere.",
    onsiteMode: "APU CAMPUS / PROPOSED",
    onlineMode: "ONLINE / HYBRID",
    onsiteItems: [
      "Faster mentor feedback and team collaboration",
      "Access to teammates and equipment",
      "Live user testing and deeper networking",
      "On-stage final showcase, subject to selection",
    ],
    onlineItems: [
      "Briefings, challenge resources and team matching",
      "Proposed mentor office hours",
      "Digital submission and remote pitches",
      "Remote finals, subject to technical confirmation",
    ],
    fairness: "One fair playing field.",
    fairnessBody:
      "Every team uses the same deadlines, judging rubric and submission format. At least one representative must attend live checkpoints.",
    judgingLabel: "05 / THE BUILD STANDARD",
    judgingTitle: "Make it work.\nMake it understandable.",
    judgingIntro:
      "Preparation principles from the brief. The final judging rubric, weights and submission platform are still to be confirmed.",
    criteria: [
      {
        title: "Real user value",
        body: "Define the problem and explain who benefits.",
      },
      {
        title: "A testable MVP",
        body: "Demonstrate the experience, beyond presentation slides.",
      },
      {
        title: "Responsible AI",
        body: "Document data use, safety and relevant limitations.",
      },
      {
        title: "Evidence from users",
        body: "Use the proposed testing sessions to learn and refine.",
      },
    ],
    mentors: "Mentors & judges",
    mentorsBody:
      "The lineup is in development. Names, roles and availability will be announced after confirmation.",
    prizes: "Awards & opportunities",
    prizesBody:
      "Prize, sponsorship and follow-up opportunity details are pending. No unconfirmed award or sponsor claims are presented.",
    ecosystemLabel: "06 / THE ECOSYSTEM",
    ecosystemTitle: "Connected by\nthe desire to build.",
    ecosystemIntro:
      "ATOX is developing this event with TAMAPUSC at Asia Pacific University of Technology & Innovation. University-wide endorsement and campus arrangements are pending.",
    watcha:
      "Supplied community identity · Role and permissions to be confirmed",
    faqLabel: "07 / GOOD TO KNOW",
    faqTitle: "Before you begin.",
    lastTitle: "Your perspective.\nA new possibility.",
    lastBody: "Bring your curiosity. Find your team. Build AI that matters.",
    nextTitle: "Your next step is coming.",
    nextBody:
      "The official interest form will be linked here once the registration owner and privacy notice are confirmed. No personal information is collected by this page.",
    nextNote:
      "The proposed dates are available to save while the programme is being finalised.",
    close: "Close",
    back: "Keep exploring",
    trackStatus: "PROPOSED DIRECTION / SUBJECT TO REVIEW",
    backEvents: "All events",
  },
  zh: {
    planning: "活动筹备中",
    eyebrow: "马来西亚 / 2026",
    titleOne: "让 AI",
    titleTwo: "创造真实价值。",
    tagline: "从真实问题，到可运行的 MVP。",
    description:
      "三天时间，连接不同专业的创造者，把值得解决的问题变成可以运行、可以测试的最小可行产品。",
    register: "登记参与意向",
    programme: "查看活动旅程",
    when: "时间",
    where: "地点",
    format: "形式",
    community: "参与者",
    date: "2026 年 12 月 4–6 日",
    venue: "线上 + APU 校园",
    venueNote: "吉隆坡 · 校园场地待批准",
    hybrid: "三天混合模式",
    hybridNote: "线上启动 → 线下开发 → 混合决赛",
    estimate: "预计 120–150 人",
    estimateNote: "规划人数 · MYT / UTC+8",
    aboutLabel: "01 / 为什么参加",
    aboutTitle: "真实的问题。\n可以运行的答案。",
    aboutBody:
      "面向 APU 及马来西亚创新生态中的学生、开发者、设计师、创业者和问题解决者。带来不同视角，做出人们真正能够试用的东西。",
    benefits: [
      {
        title: "带着目的去创造。",
        body: "从真实用户需求开始，把想法做成可运行的原型，并检验它能做什么。",
      },
      {
        title: "在实践中学习。",
        body: "拟议议程包含导师辅导、用户测试，以及产品、商业与故事表达支持。",
      },
      {
        title: "找到同行的伙伴。",
        body: "跨专业协作，分享作品、问题和项目的下一步。",
      },
    ],
    tracksLabel: "02 / 挑战赛道",
    tracksTitle: "你想在哪里，\n创造新的可能？",
    tracksIntro: "七个建议方向，从真实的用户问题出发。正式赛题仍在审核中。",
    trackDetail: "探索这个方向",
    trackStandard: "共同的标准。",
    trackStandardBody:
      "真实的用户问题。负责任的 AI。可以运行、可以测试的 MVP。",
    journeyLabel: "03 / 三天活动旅程",
    journeyTitle: "相遇。共创。呈现。",
    journeyIntro:
      "从线上连接，到校园协作，再到混合模式成果展示，一段完整的创造旅程。",
    agenda: "查看完整议程",
    allTimes: "时间均为 MYT / UTC+8。拟议议程，待最终确认。",
    fridayNote:
      "周五可参加实时说明，或观看录制内容，并在周六早上前完成团队签到。",
    calendar: "保存拟议日期至日历",
    optionsLabel: "04 / 参与方式",
    optionsTitle: "身处不同地方，\n创造共同可能。",
    optionsIntro: "选择适合团队的协作方式。校园活动须经批准并完成预订。",
    onsite: "并肩创造。",
    online: "从任何地方连接。",
    onsiteMode: "APU 校园 / 拟议",
    onlineMode: "线上 / 混合模式",
    onsiteItems: [
      "更快获得导师反馈并与团队协作",
      "便于与队友和设备协作",
      "现场用户测试与深入交流",
      "舞台决赛展示，须经选拔",
    ],
    onlineItems: [
      "活动说明、赛题资料与组队匹配",
      "拟议导师办公时间",
      "数字提交与远程路演",
      "远程参加决赛，须技术确认",
    ],
    fairness: "同一套公平规则。",
    fairnessBody:
      "所有团队使用相同的截止时间、评分标准与提交格式。至少一名代表须实时参加阶段检查。",
    judgingLabel: "05 / 创作标准",
    judgingTitle: "做得出来，\n也讲得明白。",
    judgingIntro:
      "以下为策划案中的准备原则，最终评分标准、权重与提交平台待确认。",
    criteria: [
      { title: "真实的用户价值", body: "明确问题，说明谁将受益。" },
      { title: "可测试的 MVP", body: "演示能够运行的体验，不止是幻灯片。" },
      { title: "负责任的 AI", body: "记录数据使用、安全和相关局限。" },
      { title: "来自用户的反馈", body: "通过拟议测试环节学习并完善。" },
    ],
    mentors: "导师与评委",
    mentorsBody: "阵容正在筹备。姓名、角色和参与时间将在确认后公布。",
    prizes: "奖项与后续机会",
    prizesBody:
      "奖项、赞助及后续机会待确认，页面不展示未经确认的奖项和赞助承诺。",
    ecosystemLabel: "06 / 共创生态",
    ecosystemTitle: "因为想创造，\n所以相互连接。",
    ecosystemIntro:
      "ATOX 与 TAMAPUSC 在 Asia Pacific University of Technology & Innovation 共同推进本活动。校方层面背书与校园场地安排尚待确认。",
    watcha: "已提供的社区标识 · 合作角色与使用许可待确认",
    faqLabel: "07 / 常见问题",
    faqTitle: "开始之前。",
    lastTitle: "你的视角，\n新的可能。",
    lastBody: "带来好奇心，找到你的团队，让 AI 创造真实价值。",
    nextTitle: "下一步，即将开启。",
    nextBody:
      "正式意向表单将在负责人及隐私说明确认后接入。本页面不采集个人信息。",
    nextNote: "活动筹备期间，你可以先保存拟议日期。",
    close: "关闭",
    back: "继续浏览",
    trackStatus: "建议方向 / 待审核",
    backEvents: "全部活动",
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="ex-label">
      <span />
      {children}
    </p>
  );
}

export function EventView({
  signedIn = false,
  year = 2026,
}: {
  signedIn?: boolean;
  year?: number;
}) {
  const { language } = useLanguage();
  const t = copy[language];
  const [day, setDay] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [interest, setInterest] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const modalOpen = interest || selectedTrack !== null;
  useEffect(() => {
    const el = modal.current;
    if (!el) return;
    if (modalOpen) {
      const overflow = document.body.style.overflow;
      el.showModal();
      document.body.style.overflow = "hidden";
      return () => {
        el.close();
        document.body.style.overflow = overflow;
        lastTrigger.current?.focus({ preventScroll: true });
      };
    }
  }, [modalOpen]);
  const interestLink = safeInterestUrl(event.interestUrl);
  const openInterest = (e: React.MouseEvent<HTMLButtonElement>) => {
    lastTrigger.current = e.currentTarget;
    setInterest(true);
  };
  const close = () => {
    setInterest(false);
    setSelectedTrack(null);
  };
  const downloadCalendar = () => {
    const blob = new Blob([eventCalendar()], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ATOX-Malaysia-2026-proposed.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const interestButton = (className = "ex-button") =>
    interestLink ? (
      <a
        className={className}
        href={interestLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.register}
        <span aria-hidden="true">↗</span>
      </a>
    ) : (
      <button className={className} onClick={openInterest}>
        {t.register}
        <span aria-hidden="true">↗</span>
      </button>
    );
  const activeDay = proposedDays[day];
  return (
    <div className="ex-site" id="top">
      <Header signedIn={signedIn} />
      <a className="ex-skip" href="#main-content">
        {language === "en" ? "Skip to content" : "跳至正文"}
      </a>
      <main id="main-content" tabIndex={-1}>
        <section className="ex-hero ex-container" aria-labelledby="event-title">
          <div className="ex-hero-grid">
            <div className="ex-hero-copy">
              <div className="ex-meta">
                <SectionLabel>{t.eyebrow}</SectionLabel>
                <span className="ex-status">{t.planning}</span>
              </div>
              <p className="ex-event-name">{event.name}</p>
              <p className="ex-collaboration">{event.collaboration}</p>
              <h1 id="event-title">
                {t.titleOne}
                <br />
                <em>{t.titleTwo}</em>
              </h1>
              <p className="ex-tagline">{t.tagline}</p>
              <p className="ex-description">{t.description}</p>
              <div className="ex-actions">
                {interestButton()}
                <a className="ex-text-link" href="#programme">
                  {t.programme}
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
            <div className="ex-hero-art">
              <OrbitalArt />
              <span className="ex-art-caption">03 DAYS / ONE WORKING MVP</span>
            </div>
          </div>
          <div className="ex-facts">
            {[
              [t.when, t.date, "FRI — SUN / 2026"],
              [t.where, t.venue, t.venueNote],
              [t.format, t.hybrid, t.hybridNote],
              [t.community, t.estimate, t.estimateNote],
            ].map(([a, b, c], i) => (
              <div key={a}>
                <span>
                  0{i + 1} / {a}
                </span>
                <strong>{b}</strong>
                <small>{c}</small>
              </div>
            ))}
          </div>
        </section>
        <nav
          className="ex-section-nav"
          aria-label={language === "en" ? "Event sections" : "活动内容"}
        >
          <div className="ex-container">
            <span>AI & MVP / 2026</span>
            {[
              ["purpose", language === "en" ? "Why join" : "活动价值"],
              ["tracks", language === "en" ? "Tracks" : "挑战赛道"],
              ["programme", language === "en" ? "Programme" : "三天议程"],
              [
                "participation",
                language === "en" ? "Ways to join" : "参与方式",
              ],
              ["faq", "FAQ"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
        </nav>
        <section className="ex-section ex-container" id="purpose">
          <div className="ex-heading">
            <SectionLabel>{t.aboutLabel}</SectionLabel>
            <div>
              <h2>{t.aboutTitle}</h2>
              <p>{t.aboutBody}</p>
            </div>
          </div>
          <div className="ex-benefits">
            {t.benefits.map((b, i) => (
              <article key={b.title}>
                <div className="ex-benefit-top">
                  <span>0{i + 1}</span>
                  <TrackIcon index={[0, 2, 6][i]} />
                </div>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="ex-section ex-container" id="tracks">
          <div className="ex-heading">
            <SectionLabel>{t.tracksLabel}</SectionLabel>
            <div>
              <h2>{t.tracksTitle}</h2>
              <p>{t.tracksIntro}</p>
            </div>
          </div>
          <div className="ex-tracks">
            {challengeTracks.map((track, i) => (
              <button
                className="ex-track"
                key={track.id}
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget;
                  setSelectedTrack(i);
                }}
                aria-label={`${t.trackDetail}: ${track.title[language]}`}
              >
                <div className="ex-track-top">
                  <span>0{i + 1}</span>
                  <TrackIcon index={i} />
                </div>
                <h3>{track.title[language]}</h3>
                <p>{track.description[language]}</p>
                <span className="ex-track-action">
                  {t.trackDetail}
                  <span aria-hidden="true">↗</span>
                </span>
              </button>
            ))}
            <article className="ex-track ex-track-standard">
              <span aria-hidden="true">+</span>
              <h3>{t.trackStandard}</h3>
              <p>{t.trackStandardBody}</p>
            </article>
          </div>
        </section>
        <section className="ex-section ex-container" id="programme">
          <div className="ex-heading">
            <SectionLabel>{t.journeyLabel}</SectionLabel>
            <div>
              <h2>{t.journeyTitle}</h2>
              <p>{t.journeyIntro}</p>
            </div>
          </div>
          <div className="ex-days">
            {proposedDays.map((d, i) => (
              <article key={d.date}>
                <div className="ex-day-top">
                  <span>{d.label}</span>
                  <b>{d.date}</b>
                </div>
                <h3>{d.title[language]}</h3>
                <span className="ex-mode">{d.mode[language]}</span>
                <h4>{d.subtitle[language]}</h4>
                <p className="ex-day-time">{d.time} MYT</p>
                <p>{d.description[language]}</p>
                <button
                  className="ex-day-link"
                  onClick={() => {
                    setDay(i);
                    document
                      .getElementById("full-agenda")
                      ?.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "auto"
                          : "smooth",
                        block: "start",
                      });
                  }}
                >
                  {t.agenda}
                  <span aria-hidden="true">↓</span>
                </button>
              </article>
            ))}
          </div>
          <div className="ex-agenda" id="full-agenda">
            <div className="ex-agenda-side">
              <p className="ex-label">THE PROGRAMME / MYT</p>
              <h3>{activeDay.subtitle[language]}</h3>
              <p>{t.allTimes}</p>
            </div>
            <div className="ex-agenda-content">
              <div
                className="ex-tabs"
                role="tablist"
                aria-label={language === "en" ? "Programme day" : "议程日期"}
              >
                {proposedDays.map((d, i) => (
                  <button
                    key={d.date}
                    role="tab"
                    id={`day-tab-${i}`}
                    aria-selected={day === i}
                    aria-controls={`day-panel-${i}`}
                    tabIndex={day === i ? 0 : -1}
                    onClick={() => setDay(i)}
                    onKeyDown={(e) => {
                      if (
                        !["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                          e.key,
                        )
                      )
                        return;
                      e.preventDefault();
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 2
                            : (day + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                      setDay(next);
                      document.getElementById(`day-tab-${next}`)?.focus();
                    }}
                  >
                    {d.date} DEC <span>{d.label.slice(0, 3)}</span>
                  </button>
                ))}
              </div>
              {proposedDays.map((d, i) => (
                <div
                  role="tabpanel"
                  key={d.date}
                  id={`day-panel-${i}`}
                  aria-labelledby={`day-tab-${i}`}
                  hidden={day !== i}
                  tabIndex={0}
                >
                  <ol className="ex-sessions">
                    {d.sessions.map((s) => (
                      <li key={s.time}>
                        <time>{s.time}</time>
                        <span>{s.title[language]}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
          <div className="ex-programme-foot">
            <p>{t.fridayNote}</p>
            <button className="ex-text-link" onClick={downloadCalendar}>
              {t.calendar}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="ex-inline-cta">
            <span>{t.tagline}</span>
            {interestButton()}
          </div>
        </section>
        <section className="ex-section ex-container" id="participation">
          <div className="ex-heading">
            <SectionLabel>{t.optionsLabel}</SectionLabel>
            <div>
              <h2>{t.optionsTitle}</h2>
              <p>{t.optionsIntro}</p>
            </div>
          </div>
          <div className="ex-options">
            {[
              [t.onsiteMode, t.onsite, t.onsiteItems],
              [t.onlineMode, t.online, t.onlineItems],
            ].map(([mode, title, items], i) => (
              <article key={i}>
                <span className="ex-mode">{mode as string}</span>
                <h3>{title as string}</h3>
                <ul>
                  {(items as readonly string[]).map((s) => (
                    <li key={s}>
                      <span aria-hidden="true">↗</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="ex-fairness">
            <b>{t.fairness}</b>
            <p>{t.fairnessBody}</p>
          </div>
        </section>
        <section className="ex-section ex-container" id="judging">
          <div className="ex-heading">
            <SectionLabel>{t.judgingLabel}</SectionLabel>
            <div>
              <h2>{t.judgingTitle}</h2>
              <p>{t.judgingIntro}</p>
            </div>
          </div>
          <div className="ex-criteria">
            {t.criteria.map((c, i) => (
              <article key={c.title}>
                <span>0{i + 1}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
          <div className="ex-pending">
            <article>
              <h3>{t.mentors}</h3>
              <p>{t.mentorsBody}</p>
            </article>
            <article>
              <h3>{t.prizes}</h3>
              <p>{t.prizesBody}</p>
            </article>
          </div>
        </section>
        <section className="ex-section ex-container" id="ecosystem">
          <div className="ex-heading">
            <SectionLabel>{t.ecosystemLabel}</SectionLabel>
            <div>
              <h2>{t.ecosystemTitle}</h2>
              <p>{t.ecosystemIntro}</p>
            </div>
          </div>
          <div className="ex-identities">
            <div>
              <BrandMark />
              <strong>ATOX</strong>
              <small>EVENT DEVELOPMENT</small>
            </div>
            <div>
              <strong>TAMAPUSC</strong>
              <small>COLLABORATION AT APU</small>
            </div>
            <div>
              <strong>AT APU</strong>
              <small>PROPOSED CAMPUS SETTING</small>
            </div>
          </div>
          <div className="ex-watcha">
            <Image
              src="/brand/watcha.png"
              alt="Watcha English community logo"
              width={3810}
              height={1620}
              unoptimized
            />
            <p>{t.watcha}</p>
          </div>
        </section>
        <section className="ex-section ex-container" id="faq">
          <div className="ex-faq-layout">
            <div>
              <SectionLabel>{t.faqLabel}</SectionLabel>
              <h2>{t.faqTitle}</h2>
            </div>
            <div>
              {eventFaq.map((f) => (
                <details key={f.q.en}>
                  <summary>
                    {f.q[language]}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{f.a[language]}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="ex-final">
          <div className="ex-container">
            <SectionLabel>4–6 DECEMBER 2026 / MALAYSIA</SectionLabel>
            <h2>{t.lastTitle}</h2>
            <p>{t.lastBody}</p>
            <div className="ex-actions">
              {interestButton()}
              <Link href="/events" className="ex-text-link">
                {t.backEvents}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <small>
              {t.planning} ·{" "}
              {language === "en"
                ? "Official registration to be announced."
                : "正式报名待公布。"}
            </small>
          </div>
          <OrbitalArt variant="flow" className="ex-final-art" />
        </section>
      </main>
      <HomepageFooter signedIn={signedIn} year={year} />
      <dialog
        ref={modal}
        className="ex-dialog"
        aria-labelledby="ex-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }}
      >
        <button
          className="ex-dialog-close"
          onClick={close}
          aria-label={t.close}
        >
          ×
        </button>
        {selectedTrack !== null ? (
          <>
            <SectionLabel>{t.trackStatus}</SectionLabel>
            <TrackIcon index={selectedTrack} className="ex-dialog-icon" />
            <h2 id="ex-dialog-title">
              {challengeTracks[selectedTrack].title[language]}
            </h2>
            <p>{challengeTracks[selectedTrack].prompt[language]}</p>
            <button className="ex-button" onClick={close}>
              {t.back}
              <span aria-hidden="true">↗</span>
            </button>
          </>
        ) : (
          <>
            <SectionLabel>{t.planning}</SectionLabel>
            <h2 id="ex-dialog-title">{t.nextTitle}</h2>
            <p>{t.nextBody}</p>
            <p>{t.nextNote}</p>
            <button className="ex-button" onClick={downloadCalendar}>
              {t.calendar}
              <span aria-hidden="true">↗</span>
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
