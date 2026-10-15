"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { Header } from "@/components/site-shell";
import { OrbitalArt, TrackIcon } from "@/components/brand-art";
import { homepageConfig as config } from "../config";
import { HomepageFooter } from "./navigation";
import type { HomepageContent } from "../../content-management/contracts";
import { homeCopy } from "../../content-management/home-copy";
import { EVENT_PATH } from "../../event-experience/config";

export function HomeView({
  signedIn,
  year,
  content,
}: {
  signedIn: boolean;
  year: number;
  content?: HomepageContent;
}) {
  const { language } = useLanguage();
  const t = homeCopy(language, content);
  useEffect(() => {
    if (!content) return;
    document.title = content.metadata.title[language];
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (meta) meta.content = content.metadata.description[language];
  }, [content, language]);
  return (
    <div className="hp-site" id="top">
      <Header signedIn={signedIn} />
      <a className="hp-skip" href="#main-content">
        {t.skip}
      </a>
      <main id="main-content" tabIndex={-1}>
        <section className="hp-hero hp-container" aria-labelledby="hp-title">
          <div className="hp-hero-grid">
            <div className="hp-hero-copy">
              <p className="hp-eyebrow">
                <span className="hp-live-dot" />
                {t.heroEyebrow}
              </p>
              <h1 id="hp-title">
                {t.heroLineOne}
                <br />
                {t.heroLineTwo}
                <br />
                <span>{t.heroAccent}</span>
              </h1>
              <p className="hp-hero-description">{t.heroDescription}</p>
              <div className="hp-buttons">
                <Link
                  className="hp-button hp-button-primary"
                  href={config.routes.events}
                >
                  {t.exploreEvents}
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link className="hp-text-link" href={config.routes.projects}>
                  {t.projects}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
            <div className="hp-art-panel">
              <OrbitalArt variant="flow" />
              <span>
                FROM CURIOSITY
                <br />
                TO CREATION / 001
              </span>
            </div>
          </div>
          <div className="hp-hero-bottom">
            <span>{t.demo}</span>
            <a href="#about">
              {t.exploreDown}
              <span aria-hidden="true">↓</span>
            </a>
            <span className="hp-hero-coordinate" aria-hidden="true">
              PEOPLE / IDEAS / POSSIBILITY
            </span>
          </div>
        </section>
        <div className="hp-statement-strip" aria-hidden="true">
          <span>TECHNOLOGY</span>
          <i>+</i>
          <span>PRODUCTS</span>
          <i>+</i>
          <span>GLOBAL COMMUNITY</span>
          <i>+</i>
          <span>HUMAN POSSIBILITY</span>
        </div>
        <section
          className="hp-section hp-container"
          id="about"
          aria-labelledby="hp-about-title"
        >
          <div className="hp-section-heading">
            <p className="hp-section-label">{t.aboutEyebrow}</p>
            <h2 id="hp-about-title">{t.aboutTitle}</h2>
          </div>
          <div className="hp-about-body">
            <div className="hp-about-coordinate">
              <span>ATOX</span>
              <p>
                AI YOUTH ECOSYSTEM
                <br />
                CONNECT THE NEXT
              </p>
            </div>
            <div>
              <p className="hp-about-lead">{t.aboutLead}</p>
              <p>{t.aboutBody}</p>
              <p>{t.aboutClosing}</p>
            </div>
          </div>
        </section>
        <section
          className="hp-section hp-container"
          id="programs"
          aria-labelledby="hp-programs-title"
        >
          <div className="hp-section-heading">
            <p className="hp-section-label">{t.programsEyebrow}</p>
            <div>
              <h2 id="hp-programs-title">{t.programsTitle}</h2>
              <p className="hp-section-intro">{t.programsIntro}</p>
            </div>
          </div>
          <div className="hp-program-grid">
            {t.programItems.map((item, i) => (
              <article className="hp-program" key={item.subtitle}>
                <div className="hp-program-top">
                  <span>0{i + 1}</span>
                  <TrackIcon index={[0, 6, 2][i]} />
                </div>
                <p className="hp-program-subtitle">{item.subtitle}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="hp-section hp-container hp-featured"
          aria-labelledby="hp-featured-title"
        >
          <div className="hp-section-heading">
            <p className="hp-section-label">
              {language === "en" ? "03 / NEXT ON THE HORIZON" : "03 / 即将发生"}
            </p>
            <div>
              <h2 id="hp-featured-title">
                {language === "en"
                  ? "Build AI\nthat matters."
                  : "让 AI，\n创造真实价值。"}
              </h2>
              <p className="hp-section-intro">
                {language === "en"
                  ? "ATOX × TAMAPUSC at APU. A proposed three-day hybrid hackathon in Malaysia."
                  : "ATOX × TAMAPUSC at APU，拟议三天混合模式黑客松，在马来西亚一起把想法做出来。"}
              </p>
            </div>
          </div>
          <Link className="hp-featured-link" href={EVENT_PATH}>
            <div className="hp-featured-date">
              <b>04—06</b>
              <span>DECEMBER / 2026</span>
            </div>
            <div className="hp-featured-description">
              <span className="hp-featured-status">
                {language === "en" ? "PLANNING IN PROGRESS" : "活动筹备中"}
              </span>
              <h3>
                Malaysia AI & MVP
                <br />
                Hackathon 2026
              </h3>
              <p>
                {language === "en"
                  ? "Online + APU Campus, Kuala Lumpur · Campus venue pending approval"
                  : "线上 + APU 校园，吉隆坡 · 校园场地待批准"}
              </p>
            </div>
            <span className="hp-featured-action">
              {language === "en" ? "Explore the event" : "查看活动"}
              <b aria-hidden="true">↗</b>
            </span>
          </Link>
        </section>
        <section
          className="hp-section hp-container hp-explore"
          id="explore"
          aria-labelledby="hp-explore-title"
        >
          <div className="hp-section-heading">
            <p className="hp-section-label">{t.exploreEyebrow}</p>
            <h2 id="hp-explore-title">{t.exploreTitle}</h2>
          </div>
          <div className="hp-explore-grid">
            <Link className="hp-explore-card" href={config.routes.events}>
              <span className="hp-card-tag">{t.eventCardTag}</span>
              <h3>{t.eventCardTitle}</h3>
              <p>{t.eventCardBody}</p>
              <span className="hp-card-action">
                {t.eventCardAction}
                <b aria-hidden="true">↗</b>
              </span>
            </Link>
            <Link className="hp-explore-card" href={config.routes.projects}>
              <span className="hp-card-tag">{t.projectCardTag}</span>
              <h3>{t.projectCardTitle}</h3>
              <p>{t.projectCardBody}</p>
              <span className="hp-card-action">
                {t.projectCardAction}
                <b aria-hidden="true">↗</b>
              </span>
            </Link>
          </div>
        </section>
        <section className="hp-closing hp-container">
          <p className="hp-section-label">ATOX / UNLIMITED</p>
          <h2>
            {language === "en"
              ? "A better life,\nthrough what we create."
              : "以创造，\n让生活更好。"}
          </h2>
          <Link className="hp-text-link" href="/events">
            {t.exploreEvents}
            <span aria-hidden="true">↗</span>
          </Link>
          <OrbitalArt className="hp-closing-art" />
        </section>
      </main>
      <HomepageFooter signedIn={signedIn} year={year} content={content} />
    </div>
  );
}
