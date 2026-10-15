"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { centerText } from "../i18n";
export function CenterNavigation({
  base,
  language,
  name,
  resources,
  faq,
}: {
  base: string;
  language: "zh" | "en";
  name: string;
  resources: boolean;
  faq: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = centerText[language];
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const links = [
    [base, t.lobby],
    [base + "/teams", t.teams],
    [base + "/my-team", t.mine],
    [base + "/applications", t.applications],
    [base + "/register", t.registration],
    [base + "/materials", t.materials],
  ];
  return (
    <aside className="pc-sidebar">
      <p className="pc-event-name">{name}</p>
      <button
        className="pc-menu-toggle"
        aria-expanded={open}
        aria-controls="participant-nav"
        onClick={() => setOpen(!open)}
      >
        {t.lobby} / {language === "zh" ? "菜单" : "Menu"} ☰
      </button>
      <nav
        id="participant-nav"
        className={open ? "pc-links open" : "pc-links"}
        aria-label={
          language === "zh" ? "选手中心导航" : "Participant center navigation"
        }
        onClick={() => setOpen(false)}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        {resources && <Link href={base + "#resources"}>{t.resources}</Link>}
        {faq && <Link href={base + "#faq"}>{t.faq}</Link>}
        <Link href="/events">
          ← {language === "zh" ? "返回活动展板" : "All events"}
        </Link>
      </nav>
    </aside>
  );
}
