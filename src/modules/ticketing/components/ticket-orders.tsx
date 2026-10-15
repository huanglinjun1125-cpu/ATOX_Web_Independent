"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ticketRequest, TicketError } from "../client";
import { TICKETING_PAGE, type OrderListDto } from "../contracts";
import { orderListCopy } from "../order-list-copy";
import { money, ticketDate, TicketShell, useTicketText } from "./shared";

export function TicketOrders({ page }: { page: number }) {
  const { language } = useTicketText();
  const t = orderListCopy[language];
  const router = useRouter();
  const [data, setData] = useState<OrderListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await ticketRequest<OrderListDto>(
        `/orders?page=${page}`,
        "GET",
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) setData(result);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof TicketError && failure.status === 401) {
        setData(null);
        router.replace(
          "/login?next=" +
            encodeURIComponent(TICKETING_PAGE + `/orders?page=${page}`),
        );
      } else setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, router]);
  function reload() {
    setLoading(true);
    setError(false);
    void load();
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);
  const pageUrl = (target: number) => TICKETING_PAGE + `/orders?page=${target}`;
  return (
    <TicketShell step="orders">
      <section className="tk-orders">
        <div className="tk-orders-heading">
          <div>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <button type="button" onClick={reload} disabled={loading}>
            {t.refresh}
          </button>
        </div>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="tk-orders-empty" role="status">
              {t.loading}
            </p>
          ) : error ? (
            <div className="tk-orders-empty" role="alert">
              <p>{t.error}</p>
              <button onClick={reload}>{t.retry}</button>
            </div>
          ) : (
            data && (
              <>
                <p className="tk-order-count">
                  {data.total} {t.count}
                </p>
                {data.orders.length ? (
                  <div className="tk-orders-list">
                    {data.orders.map((order) => {
                      const status = order.reconciliationRequired
                        ? "reconciliation"
                        : order.status === "pending" &&
                            ["unknown", "creating", "pending"].includes(
                              order.paymentStatus,
                            )
                          ? "confirming"
                          : order.status;
                      const href =
                        TICKETING_PAGE +
                        "/checkout?orderId=" +
                        encodeURIComponent(order.id);
                      return (
                        <article
                          className="tk-order-card"
                          key={order.id}
                          data-order-id={order.id}
                        >
                          <div className="tk-order-top">
                            <h2>{order.eventName[language]}</h2>
                            <span
                              className={
                                "tk-order-state tk-order-state-" + status
                              }
                            >
                              {t[status]}
                            </span>
                          </div>
                          <h3>{order.ticketName[language]}</h3>
                          <dl>
                            <div className="tk-order-id">
                              <dt>{t.number}</dt>
                              <dd>{order.id}</dd>
                            </div>
                            <div>
                              <dt>{t.created}</dt>
                              <dd>
                                {ticketDate(
                                  order.createdAt,
                                  order.timeZone,
                                  language,
                                )}{" "}
                                <small>{order.timeZone}</small>
                              </dd>
                            </div>
                            <div>
                              <dt>{t.quantity}</dt>
                              <dd>{order.quantity}</dd>
                            </div>
                            <div>
                              <dt>{t.amount}</dt>
                              <dd className="tk-order-amount">
                                {money(
                                  order.totalAmount,
                                  order.currency,
                                  language,
                                )}
                              </dd>
                            </div>
                          </dl>
                          {status === "confirming" && (
                            <p className="tk-order-note">{t.unknownHint}</p>
                          )}
                          {status === "reconciliation" && (
                            <p className="tk-order-note">
                              {t.reconciliationHint}
                            </p>
                          )}
                          <div className="tk-order-actions">
                            <Link href={href}>{t.view} ↗</Link>
                            {order.canPay && status === "pending" && (
                              <Link className="tk-order-pay" href={href}>
                                {t.pay} →
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tk-orders-empty">
                    <h2>{data.total > 0 ? t.outOfRange : t.empty}</h2>
                    <p>{t.emptyHint}</p>
                    <Link href={data.total > 0 ? pageUrl(1) : TICKETING_PAGE}>
                      {data.total > 0 ? t.first : t.buy} ↗
                    </Link>
                  </div>
                )}
                {data.totalPages > 0 && (
                  <nav className="tk-orders-pages" aria-label={t.pagination}>
                    <button
                      disabled={page <= 1}
                      onClick={() =>
                        router.push(
                          pageUrl(Math.min(page - 1, data.totalPages)),
                        )
                      }
                    >
                      ← {t.previous}
                    </button>
                    <span>
                      {page} / {data.totalPages}
                    </span>
                    <button
                      disabled={page >= data.totalPages}
                      onClick={() => router.push(pageUrl(page + 1))}
                    >
                      {t.next} →
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </div>
      </section>
    </TicketShell>
  );
}
