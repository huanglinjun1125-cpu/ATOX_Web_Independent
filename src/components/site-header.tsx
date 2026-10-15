"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-art";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language-provider";
import { useTicketingNavigation } from "./site-navigation-provider";
import { TICKETING_PAGE } from "@/modules/ticketing/contracts";
import { homepageConfig as config } from "@/modules/homepage/config";
import { adminRequest } from "@/modules/admin/client";
import type { AdminIdentity } from "@/modules/admin/contracts";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname() ?? "/";
  const ticketingEnabled = useTicketingNavigation();
  const t = {
    ...config.copy[language],
    projects: language === "zh" ? "项目" : "Projects",
  };
  const [open, setOpen] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    let controller: AbortController | null = null;
    async function checkAccess() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      setAdminVisible(false);
      try {
        await adminRequest<{ administrator: AdminIdentity }>(
          "/me",
          "GET",
          undefined,
          current.signal,
        );
        if (active && !current.signal.aborted) setAdminVisible(true);
      } catch {
        // Navigation is only a convenience; page and API authorization is server-side.
        if (active && !current.signal.aborted) setAdminVisible(false);
      }
    }
    void checkAccess();
    const onFocus = () => void checkAccess();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [signedIn, open]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const links = [
    [config.routes.home, language === "zh" ? "首页" : "Home"],
    [config.routes.events, t.events],
    [config.routes.projects, t.projects],
  ];
  return (
    <header
      className="site-header"
      ref={header}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <div className="sn-header-inner">
        <Link
          href={config.routes.home}
          className="sn-brand"
          aria-label={t.homeLabel}
          onClick={() => setOpen(false)}
        >
          <span className="sn-brand-symbol" aria-hidden="true">
            <BrandMark />
          </span>
          {config.brand}
          <span className="sn-brand-dot" aria-hidden="true" />
        </Link>
        <div className="sn-header-actions">
          <button
            className="sn-language"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={t.languageLabel}
          >
            {t.language}
            <span aria-hidden="true">↗</span>
          </button>
          <Link
            className="sn-auth"
            href={signedIn ? config.routes.account : config.routes.login}
            onClick={() => setOpen(false)}
          >
            {signedIn ? t.account : t.login}
            <span aria-hidden="true">↗</span>
          </Link>
          <button
            ref={toggle}
            className="sn-menu-toggle"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            aria-controls="sn-primary-nav"
            onClick={() => {
              setAdminVisible(false);
              setOpen(!open);
            }}
          >
            <span aria-hidden="true">{open ? "×" : "☰"}</span>
          </button>
        </div>
        <nav
          id="sn-primary-nav"
          className={"sn-primary-nav" + (open ? " is-open" : "")}
          aria-label={t.primaryNav}
          onClick={(event) => {
            if ((event.target as Element).closest("a")) {
              setOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                href === "/"
                  ? pathname === "/"
                    ? "page"
                    : undefined
                  : pathname.startsWith(href)
                    ? "page"
                    : undefined
              }
            >
              {label}
              {href === config.routes.projects && (
                <span className="sn-nav-soon" aria-hidden="true">
                  ↗
                </span>
              )}
            </Link>
          ))}
          {ticketingEnabled && (
            <Link className="sn-ticketing-link" href={TICKETING_PAGE}>
              {language === "zh" ? "购票（模拟）" : "Tickets (Demo)"}
            </Link>
          )}
          {signedIn && adminVisible && open && (
            <Link href="/admin">
              {language === "zh" ? "管理后台" : "Admin"}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
