"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { adminCopy } from "../copy";
import { AdminApiError } from "../client";
import type { AdminIdentity, AdminPage } from "../contracts";

export function useAdminText() {
  const { language } = useLanguage();
  return { language, t: adminCopy[language] };
}
export function adminErrorText(error: unknown, language: "zh" | "en") {
  const t = adminCopy[language];
  if (error instanceof AdminApiError) {
    if (error.status === 401) return t.expired;
    if (error.status === 403) return t.deniedDetail;
    if (error.code === "REVISION_CONFLICT") return t.conflict;
    return t.errors[error.code as keyof typeof t.errors] ?? t.network;
  }
  return t.network;
}
export function dateText(value: string, language: "zh" | "en") {
  return (
    new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
      timeZone: "Asia/Shanghai",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value)) + " (UTC+8)"
  );
}
export function AccessDenied({ expired = false }: { expired?: boolean }) {
  const { t } = useAdminText();
  const pathname = usePathname();
  return (
    <section
      className="adm-panel adm-denied"
      aria-labelledby="adm-denied-title"
    >
      <p className="adm-eyebrow">ATOX / ADMIN</p>
      <h1 id="adm-denied-title">{expired ? t.login : t.denied}</h1>
      <p>{expired ? t.expired : t.deniedDetail}</p>
      <div className="adm-actions">
        {expired && (
          <Link
            className="adm-button"
            href={"/login?next=" + encodeURIComponent(pathname)}
          >
            {t.login}
          </Link>
        )}
        <Link className="adm-button secondary" href="/">
          {t.home}
        </Link>
        <Link href="/account">{t.account}</Link>
      </div>
    </section>
  );
}
export function AdminShell({
  identity,
  children,
}: {
  identity: AdminIdentity;
  children: React.ReactNode;
}) {
  const { t } = useAdminText();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const links = [["/admin", t.dashboard]];
  if (identity.permissions.includes("admin:materials"))
    links.push(["/admin/materials", t.materials]);
  if (identity.permissions.includes("admin:content"))
    links.push(
      ["/admin/events", t.events],
      ["/admin/content/homepage", t.content],
    );
  if (identity.role === "super_admin")
    links.push(
      ["/admin/administrators", t.administrators],
      ["/admin/audit", t.audit],
    );
  return (
    <div className="adm-workspace">
      <aside className="adm-sidebar">
        <p className="adm-eyebrow">OFFICIAL / ADMIN</p>
        <h2>{t.title}</h2>
        <p className="adm-identity">{identity.email}</p>
        <span className="adm-badge">{t[identity.role]}</span>
        <button
          ref={toggle}
          type="button"
          className="adm-menu-toggle"
          aria-expanded={open}
          aria-controls="adm-navigation"
          onClick={() => setOpen(!open)}
        >
          {t.menu} ☰
        </button>
        <nav
          id="adm-navigation"
          className={open ? "is-open" : ""}
          aria-label={t.navigation}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href ||
                (href !== "/admin" && pathname.startsWith(href + "/"))
                  ? "page"
                  : undefined
              }
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              {label}
            </Link>
          ))}
          <Link href="/">← {t.home}</Link>
        </nav>
      </aside>
      <div className="adm-content">{children}</div>
    </div>
  );
}
export function Dashboard({ identity }: { identity: AdminIdentity }) {
  const { t } = useAdminText();
  return (
    <AdminShell identity={identity}>
      <section className="adm-panel">
        <p className="adm-eyebrow">M008 / 01</p>
        <h1>{t.welcome}</h1>
        <p>{t.intro}</p>
        <p>{t.scope}</p>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/materials">
            {t.materials} ↗
          </Link>
          <Link className="adm-button" href="/admin/events">
            {t.events} ↗
          </Link>
          <Link className="adm-button" href="/admin/content/homepage">
            {t.content} ↗
          </Link>
        </div>
      </section>
      <section className="adm-panel">
        <h2>
          {t.role}: {t[identity.role]}
        </h2>
        <p>
          {identity.role === "super_admin" ? t.superScope : t.operatorScope}
        </p>
        {identity.role === "super_admin" && (
          <div className="adm-actions">
            <Link className="adm-button" href="/admin/administrators">
              {t.administrators} ↗
            </Link>
            <Link className="adm-button secondary" href="/admin/audit">
              {t.audit} ↗
            </Link>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
export function Pagination({
  data,
  busy,
  change,
}: {
  data: AdminPage<unknown>;
  busy: boolean;
  change: (page: number) => void;
}) {
  const { t } = useAdminText();
  return (
    <div className="adm-pagination">
      <span>
        {data.total} {t.total} · {t.page} {data.page}/
        {Math.max(1, data.totalPages)}
      </span>
      <div className="adm-actions">
        <button
          type="button"
          disabled={busy || data.page <= 1}
          onClick={() => change(data.page - 1)}
        >
          {t.previous}
        </button>
        <button
          type="button"
          disabled={busy || data.page >= data.totalPages}
          onClick={() => change(data.page + 1)}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}
export function AdminDialog({
  title,
  close,
  busy,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const { t } = useAdminText();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      aria-labelledby="adm-dialog-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
        if (event.key !== "Tab") return;
        const dialog = ref.current!;
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((item) => item.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (document.activeElement === dialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="adm-heading">
        <h2 id="adm-dialog-title">{title}</h2>
        <button
          type="button"
          aria-label={t.close}
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
