"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TICKETING_PAGE } from "../contracts";
import type { CatalogDto, Selection } from "../contracts";
import {
  EventDetails,
  money,
  ticketDate,
  storageRead,
  storageWrite,
  TicketShell,
  useTicketText,
} from "./shared";
export function TicketPicker({
  catalog,
  userId,
  email,
  query,
}: {
  catalog: CatalogDto;
  userId: string | null;
  email: string | null;
  query: { ticketId?: string; quantity?: string };
}) {
  const { language, t } = useTicketText();
  const router = useRouter();
  const key = `ticketing:${catalog.event.id}:${userId ?? "anonymous"}:selection`;
  const [selection, setSelection] = useState<Selection>({
    ticketId: query.ticketId ?? "",
    quantity: Number(query.quantity) || 1,
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = storageRead<Selection>(key, {
        ticketId:
          catalog.tickets.find((ticket) => ticket.state === "on_sale")?.id ??
          "",
        quantity: 1,
      });
      setSelection({
        ticketId: query.ticketId ?? saved.ticketId,
        quantity: Math.max(
          1,
          Math.min(
            catalog.maxPerAccount,
            Number(query.quantity) || saved.quantity || 1,
          ),
        ),
      });
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [key, catalog, query.ticketId, query.quantity]);
  function update(next: Selection) {
    setSelection(next);
    storageWrite(key, next);
  }
  const ticket = catalog.tickets.find((item) => item.id === selection.ticketId);
  const canBuy =
    ticket?.state === "on_sale" && ticket.available >= selection.quantity;
  function next() {
    storageWrite(key, selection);
    const path =
      TICKETING_PAGE +
      "/checkout?" +
      new URLSearchParams({
        ticketId: selection.ticketId,
        quantity: String(selection.quantity),
      });
    router.push(userId ? path : "/login?next=" + encodeURIComponent(path));
  }
  return (
    <TicketShell step={1}>
      <div className="tk-columns">
        <section className="tk-card tk-event">
          <EventDetails catalog={catalog} />
        </section>
        <aside>
          <section className="tk-card">
            <span className="tk-eyebrow">01 / TICKETS</span>
            <h2>{t.select}</h2>
            {email && (
              <p className="tk-muted">
                {t.email}: {email}
              </p>
            )}
            <div className="tk-ticket-list">
              {catalog.tickets.map((item) => (
                <label
                  className={`tk-ticket ${selection.ticketId === item.id ? "selected" : ""}`}
                  key={item.id}
                >
                  <input
                    type="radio"
                    name="ticket"
                    checked={selection.ticketId === item.id}
                    disabled={item.state !== "on_sale"}
                    onChange={() => update({ ticketId: item.id, quantity: 1 })}
                  />
                  <span>
                    <strong>{item.name[language]}</strong>
                    <small>{t[item.state]}</small>
                    <small>
                      {t.saleWindow}:{" "}
                      {ticketDate(
                        item.opensAt,
                        catalog.event.timeZone,
                        language,
                      )}{" "}
                      —{" "}
                      {ticketDate(
                        item.closesAt,
                        catalog.event.timeZone,
                        language,
                      )}{" "}
                      ({catalog.event.timeZone})
                    </small>
                  </span>
                  <b>{money(item.unitAmount, item.currency, language)}</b>
                </label>
              ))}
            </div>
            <label className="tk-label" htmlFor="ticket-quantity">
              {t.quantity}
            </label>
            <div className="tk-quantity">
              <button
                aria-label={t.decrease}
                disabled={selection.quantity <= 1}
                onClick={() =>
                  update({ ...selection, quantity: selection.quantity - 1 })
                }
              >
                −
              </button>
              <input
                id="ticket-quantity"
                type="number"
                min={1}
                max={Math.min(catalog.maxPerAccount, ticket?.available ?? 0)}
                value={selection.quantity}
                onChange={(e) =>
                  update({
                    ...selection,
                    quantity: Math.max(
                      1,
                      Math.min(
                        catalog.maxPerAccount,
                        Number(e.target.value) || 1,
                      ),
                    ),
                  })
                }
              />
              <button
                aria-label={t.increase}
                disabled={
                  selection.quantity >=
                  Math.min(catalog.maxPerAccount, ticket?.available ?? 0)
                }
                onClick={() =>
                  update({ ...selection, quantity: selection.quantity + 1 })
                }
              >
                +
              </button>
            </div>
            <p className="tk-muted">
              {t.limit} {catalog.maxPerAccount} {t.ticketUnit}
            </p>
            <div className="tk-total">
              <span>{t.total}</span>
              <strong>
                {ticket
                  ? money(
                      ticket.unitAmount * selection.quantity,
                      ticket.currency,
                      language,
                    )
                  : "—"}
              </strong>
            </div>
            <button
              className="tk-button tk-primary"
              disabled={!ready || !canBuy}
              onClick={next}
            >
              {userId ? t.next : t.signin} ↗
            </button>
            {!canBuy && <p className="tk-muted">{t.unavailable}</p>}
          </section>
          <section className="tk-policy">
            <h3>{t.refund}</h3>
            <p>{catalog.event.policy[language]}</p>
            <h3>{t.contact}</h3>
            <p>{catalog.event.contact[language]}</p>
          </section>
        </aside>
      </div>
    </TicketShell>
  );
}
