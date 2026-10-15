"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TICKETING_PAGE } from "../contracts";
import type { CatalogDto, Selection } from "../contracts";
import { money, ticketDate, TicketShell, useTicketText } from "./shared";
import { useCheckout } from "./use-checkout";
import { TicketConfirmDialog } from "./confirm-dialog";
function ReservationCountdown({
  expiresAt,
  serverNow,
  onExpire,
}: {
  expiresAt: string;
  serverNow: number;
  onExpire: () => void;
}) {
  const { t } = useTicketText();
  const notified = useRef(false);
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - serverNow) / 1000),
  );
  useEffect(() => {
    if (remaining === 0 && !notified.current) {
      notified.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);
  return (
    <p className="tk-muted">
      {t.reservationCountdown}:{" "}
      {String(Math.floor(remaining / 60)).padStart(2, "0")}:
      {String(remaining % 60).padStart(2, "0")}
      {remaining === 0 && <span> · {t.expiryChecking}</span>}
    </p>
  );
}
export function TicketCheckout(props: {
  catalog: CatalogDto;
  user: { id: string; email: string };
  selection: Selection;
  orderId?: string;
}) {
  const { catalog, user, selection, orderId } = props;
  const { language, t } = useTicketText();
  const router = useRouter();
  const {
    answers,
    quote,
    policy,
    order,
    ready,
    busy,
    error,
    uncertain,
    creationUncertain,
    existingOrderId,
    quoteLoading,
    valid,
    serverElapsed,
    selected,
    effective,
    confirmOpen,
    simulatorOpen,
    setConfirmOpen,
    setSimulatorOpen,
    changeAnswers,
    retryQuote,
    create,
    recoverCreation,
    refresh,
    pay,
    simulate,
    changeSelection,
    closeAndChange,
  } = useCheckout(props);
  const shownEvent = order?.event ?? catalog.event;
  const shownQuestions = order?.questions ?? catalog.questions;
  const shownAnswers = order?.answers ?? answers;
  const canStartPayment =
    !!order &&
    order.canPay &&
    ["idle", "failed", "cancelled"].includes(order.paymentStatus);
  const paymentUncertain =
    uncertain ||
    order?.paymentStatus === "unknown" ||
    order?.paymentStatus === "creating";
  const paymentText =
    order?.paymentStatus === "pending"
      ? t.paymentPending
      : order?.paymentStatus === "unknown"
        ? t.unknown
        : order
          ? t[order.paymentStatus]
          : "";
  return (
    <TicketShell step={2}>
      <h1>{order ? t.orderStatus : t.checkout}</h1>
      {error && (
        <p className="tk-error" role="alert">
          {error}
        </p>
      )}
      {!ready ? (
        <p className="tk-card">{t.restoring}</p>
      ) : orderId && !order ? (
        <section className="tk-card">
          <p>{t.error}</p>
          <button
            className="tk-button tk-secondary"
            onClick={() => void refresh(orderId)}
          >
            {t.retry}
          </button>
        </section>
      ) : (
        <div className="tk-columns">
          <section className="tk-card">
            <span className="tk-eyebrow">02 / CHECKOUT</span>
            <h2>{t.details}</h2>
            <form
              id="ticket-checkout-form"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <fieldset disabled={busy || creationUncertain || !!order}>
                <label className="tk-label" htmlFor="buyer-email">
                  {t.email}
                  <input
                    id="buyer-email"
                    value={user.email}
                    readOnly
                    type="email"
                  />
                </label>
                <div className="tk-form-grid">
                  <label className="tk-label" htmlFor="buyer-name">
                    {t.displayName} *
                    <input
                      id="buyer-name"
                      required
                      maxLength={100}
                      value={shownAnswers.displayName}
                      onChange={(e) =>
                        changeAnswers({
                          ...answers,
                          displayName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="tk-label" htmlFor="buyer-country">
                    {t.country} *
                    <input
                      id="buyer-country"
                      required
                      maxLength={100}
                      value={shownAnswers.country}
                      onChange={(e) =>
                        changeAnswers({ ...answers, country: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="tk-label" htmlFor="buyer-source">
                  {t.source} *
                  <select
                    id="buyer-source"
                    required
                    value={shownAnswers.source}
                    onChange={(e) =>
                      changeAnswers({ ...answers, source: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {shownQuestions.sources.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label[language]}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="tk-purposes">
                  <legend>{t.purposes} *</legend>
                  {shownQuestions.purposes.map((item) => (
                    <label className="tk-check" key={item.id}>
                      <input
                        type="checkbox"
                        checked={shownAnswers.purposes.includes(item.id)}
                        onChange={(e) =>
                          changeAnswers({
                            ...answers,
                            purposes: e.target.checked
                              ? [...answers.purposes, item.id]
                              : answers.purposes.filter((id) => id !== item.id),
                          })
                        }
                      />
                      <span>{item.label[language]}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="tk-label" htmlFor="buyer-notes">
                  {t.notes}
                  <textarea
                    id="buyer-notes"
                    rows={3}
                    maxLength={2000}
                    value={shownAnswers.notes}
                    onChange={(e) =>
                      changeAnswers({ ...answers, notes: e.target.value })
                    }
                  />
                </label>
                <div className="tk-policy-inline">
                  <h3>{t.refund}</h3>
                  <p>{(order?.policy ?? policy)[language]}</p>
                </div>
                <label className="tk-check">
                  <input
                    required
                    type="checkbox"
                    checked={shownAnswers.acceptedPolicy}
                    onChange={(e) =>
                      changeAnswers({
                        ...answers,
                        acceptedPolicy: e.target.checked,
                      })
                    }
                  />
                  <span>{t.acceptedPolicy} *</span>
                </label>
              </fieldset>
            </form>
          </section>
          <aside>
            <section className="tk-card tk-summary">
              <h2>{order ? t.orderStatus : quote ? t.summary : t.selection}</h2>
              <h3>{shownEvent.name[language]}</h3>
              <p>
                {(order?.ticketName ?? quote?.ticketName ?? selected?.name)?.[
                  language
                ] ?? "—"}{" "}
                × {effective.quantity}
              </p>
              {order ? (
                <>
                  <p
                    className={
                      "tk-order-state tk-order-state-" +
                      (order.reconciliationRequired
                        ? "reconciliation"
                        : paymentUncertain || order.paymentStatus === "pending"
                          ? "confirming"
                          : order.status)
                    }
                    role="status"
                  >
                    {order.reconciliationRequired
                      ? t.reconcile
                      : order.status === "paid"
                        ? t.paid
                        : order.status === "closed"
                          ? t.closed
                          : paymentUncertain ||
                              order.paymentStatus === "pending"
                            ? t.confirming
                            : t.pending}
                  </p>
                  <dl>
                    <dt>{t.orderId}</dt>
                    <dd>{order.id}</dd>
                    <dt>{t.expires}</dt>
                    <dd>
                      {ticketDate(
                        order.expiresAt,
                        shownEvent.timeZone,
                        language,
                      )}
                    </dd>
                    <dt>{t.paymentStatus}</dt>
                    <dd>{paymentText}</dd>
                  </dl>
                  {order.status === "pending" && (
                    <ReservationCountdown
                      expiresAt={order.expiresAt}
                      key={order.id}
                      serverNow={Date.parse(catalog.serverNow) + serverElapsed}
                      onExpire={() => void refresh(order.id)}
                    />
                  )}{" "}
                  {paymentUncertain && <p className="tk-notice">{t.unknown}</p>}
                </>
              ) : null}
              <div className="tk-total">
                <span>{order || quote ? t.total : t.estimate}</span>
                <strong>
                  {money(
                    order?.totalAmount ??
                      quote?.totalAmount ??
                      (selected?.unitAmount ?? 0) * selection.quantity,
                    order?.currency ??
                      quote?.currency ??
                      selected?.currency ??
                      "CNY",
                    language,
                  )}
                </strong>
              </div>
              {quote && !order && (
                <>
                  <p className="tk-muted">
                    {t.unit}:{" "}
                    {money(quote.unitAmount, quote.currency, language)} ×{" "}
                    {quote.quantity}
                  </p>
                  <p>
                    {shownAnswers.displayName} · {shownAnswers.country}
                  </p>
                  <p>{quote.policy[language]}</p>
                </>
              )}
              {!order && (
                <div aria-live="polite">
                  {creationUncertain ? (
                    <>
                      <p className="tk-notice">{t.creationUnknown}</p>
                      <button
                        className="tk-button tk-secondary"
                        disabled={busy}
                        onClick={() => void recoverCreation()}
                      >
                        {busy ? t.busy : t.recoverOrder}
                      </button>
                    </>
                  ) : existingOrderId ? (
                    <>
                      <p className="tk-notice">{t.existingOrder}</p>
                      <Link
                        className="tk-button tk-secondary"
                        href={
                          TICKETING_PAGE +
                          "/checkout?orderId=" +
                          encodeURIComponent(existingOrderId)
                        }
                      >
                        {t.continueOrder} ↗
                      </Link>
                    </>
                  ) : (
                    <>
                      {!quote && (
                        <p className="tk-muted">
                          {quoteLoading || (valid && !error)
                            ? t.quoting
                            : error
                              ? t.quoteFailed
                              : t.completeForQuote}
                        </p>
                      )}
                      {error && !quote && valid && (
                        <button
                          className="tk-button tk-secondary"
                          disabled={busy || quoteLoading}
                          onClick={retryQuote}
                        >
                          {t.retryQuote}
                        </button>
                      )}
                      <button
                        type="submit"
                        form="ticket-checkout-form"
                        className="tk-button tk-primary"
                        disabled={busy || !quote || quoteLoading || !valid}
                      >
                        {busy ? t.busy : t.confirmAndPay} ↗
                      </button>
                    </>
                  )}
                </div>
              )}
              {order && (
                <>
                  <button
                    className="tk-button tk-secondary"
                    disabled={busy}
                    onClick={() => void refresh()}
                  >
                    {t.refresh}
                  </button>
                  {canStartPayment &&
                    !paymentUncertain &&
                    order.status === "pending" && (
                      <button
                        className="tk-button tk-primary"
                        disabled={busy}
                        onClick={() => void pay()}
                      >
                        {busy ? t.busy : t.pay}
                      </button>
                    )}
                </>
              )}
              {order?.status === "paid" && (
                <button
                  className="tk-text-button"
                  onClick={() => router.push(TICKETING_PAGE)}
                >
                  {t.buyAgain} ↗
                </button>
              )}
              {(!order || order.status !== "paid") && (
                <button
                  className="tk-text-button"
                  disabled={busy || creationUncertain}
                  onClick={() => void changeSelection()}
                >
                  {t.change} ↗
                </button>
              )}
            </section>
            {order && (
              <details
                className="tk-card tk-simulator"
                open={simulatorOpen}
                onToggle={(event) => setSimulatorOpen(event.currentTarget.open)}
              >
                <summary>{t.simulation}</summary>
                <p>{t.demo}</p>
                <div>
                  {(
                    [
                      "success",
                      "failure",
                      "cancel",
                      "unknown",
                      "duplicate",
                      "late_success",
                    ] as const
                  ).map((action) => (
                    <button
                      key={action}
                      className="tk-sim-button"
                      disabled={busy}
                      onClick={() => void simulate(action)}
                    >
                      {action === "unknown" ? t.simulateUnknown : t[action]}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </aside>
        </div>
      )}
      {confirmOpen && (
        <TicketConfirmDialog
          busy={busy}
          close={() => setConfirmOpen(false)}
          confirm={() => void closeAndChange()}
        />
      )}
    </TicketShell>
  );
}
