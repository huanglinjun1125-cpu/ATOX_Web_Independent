"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { homepageConfig as config } from "../config";
import type { HomepageContent } from "../../content-management/contracts";
import { homeCopy } from "../../content-management/home-copy";

export { SiteHeader as HomepageHeader } from "@/components/site-header";

export function HomepageFooter({
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
  const groups = [
    {
      title: t.footerAbout,
      links: [
        [config.routes.about, t.about],
        [config.routes.programs, t.programs],
      ],
    },
    {
      title: t.footerExplore,
      links: [
        [config.routes.events, t.events],
        [config.routes.projects, t.projects],
      ],
    },
    {
      title: t.footerAccount,
      links: [
        [
          signedIn ? config.routes.account : config.routes.login,
          signedIn ? t.account : t.login,
        ],
      ],
    },
  ];
  return (
    <footer className="hp-footer">
      <div className="hp-footer-top hp-container">
        <div className="hp-footer-brand">
          <Link href={config.routes.home}>
            {config.brand}
            <span aria-hidden="true">✳</span>
          </Link>
          <p>{t.footerTagline}</p>
        </div>
        <nav aria-label={t.footerNav} className="hp-footer-nav">
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([href, label]) => (
                <Link href={href} key={href}>
                  {label}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="hp-footer-bottom hp-container">
        <span>
          © {year} {config.brand}
        </span>
        <small>{t.footerNote}</small>
        <a href="#top">
          {t.backTop}
          <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
