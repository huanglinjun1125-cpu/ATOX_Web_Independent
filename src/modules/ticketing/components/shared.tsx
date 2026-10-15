"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { ticketMessages } from "../i18n";
import type { CatalogDto } from "../contracts";
import { TICKETING_PAGE } from "../contracts";
import { orderListCopy } from "../order-list-copy";
export function useTicketText() {
  const { language, setLanguage } = useLanguage();
  return { language, setLanguage, t: ticketMessages[language] };
}
export function money(amount: number, currency: string, language: "zh" | "en") {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount / 100);
}
export function ticketDate(date: string, zone: string, language: "zh" | "en") {
  return new Date(date).toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function TicketShell({
  children,
  step,
}: {
  children: React.ReactNode;
  step: 1 | 2 | "orders";
}) {
  const { language, t } = useTicketText();
  return (
    <div className="tk-module">
      <main className="tk-main">
        <div className="tk-banner">◉ {t.demo}</div>
        <nav
          className="tk-module-nav"
          aria-label={orderListCopy[language].navigation}
        >
          <Link
            href={TICKETING_PAGE}
            aria-current={step !== "orders" ? "page" : undefined}
          >
            {orderListCopy[language].buy}
          </Link>
          <Link
            href={TICKETING_PAGE + "/orders"}
            aria-current={step === "orders" ? "page" : undefined}
          >
            {orderListCopy[language].orders}
          </Link>
        </nav>
        {step !== "orders" && (
          <nav className="tk-steps">
            <span className={step === 1 ? "active" : ""}>
              01 <span>{t.tickets}</span>
            </span>
            <i />
            <span className={step === 2 ? "active" : ""}>
              02 <span>{t.checkout}</span>
            </span>
          </nav>
        )}
        {children}
      </main>
      <p className="tk-eligibility">{t.notice}</p>
    </div>
  );
}
export function EventDetails({ catalog }: { catalog: CatalogDto }) {
  const { language, t } = useTicketText();
  const event = catalog.event;
  return (
    <>
      <div className="tk-event-visual" aria-hidden="true">
        <small>OPEN YOUR MIND. MAKE YOUR NEXT.</small>
        <strong>
          BUILD
          <br />
          WHAT’S
          <br />
          <em>NEXT.</em>
        </strong>
        <span>✳</span>
        <b>OPEN DAY / DEMO</b>
      </div>
      <h1>{event.name[language]}</h1>
      <p className="tk-intro">{event.introduction[language]}</p>
      <dl className="tk-details">
        <dt>{t.organizer}</dt>
        <dd>{event.organizer[language]}</dd>
        <dt>{t.time}</dt>
        <dd>
          {ticketDate(event.startsAt, event.timeZone, language)} —{" "}
          {ticketDate(event.endsAt, event.timeZone, language)}
          <small>{event.timeZone}</small>
        </dd>
        <dt>{t.location}</dt>
        <dd>{event.location[language]}</dd>
      </dl>
    </>
  );
}
export function storageRead<T>(key: string, fallback: T): T {
  try {
    const text = sessionStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function storageWrite(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
