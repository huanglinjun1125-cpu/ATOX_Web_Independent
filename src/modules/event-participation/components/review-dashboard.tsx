"use client";
import { useState } from "react";
import type { ReviewItem, ReviewInput } from "../contracts";
import { EventApiError } from "../client";
import {
  dateText,
  errorText,
  EventShell,
  MaterialPreview,
  Status,
  useEventText,
} from "./shared";
function ReviewCard({
  item,
  onSaved,
}: {
  item: ReviewItem;
  onSaved: () => Promise<ReviewItem[] | null>;
}) {
  const { language, t, eventConfig, eventRequest } = useEventText();
  const [binding, setBinding] = useState({
    revision: item.revision,
    submittedRevision: item.submittedRevision,
    internalNote: item.internalNote ?? "",
  });
  const [action, setAction] = useState<ReviewInput["action"]>("needs_changes");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState(item.internalNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(false);
  const dirty =
    publicNote !== "" ||
    internalNote !== binding.internalNote ||
    action !== "needs_changes";
  const incomingChanged =
    item.revision !== binding.revision ||
    item.submittedRevision !== binding.submittedRevision;
  const stale = conflict || incomingChanged;
  // A pristine card can follow server updates. Edited cards keep their original binding and input.
  if (incomingChanged && !dirty && !busy && !conflict) {
    setBinding({
      revision: item.revision,
      submittedRevision: item.submittedRevision,
      internalNote: item.internalNote ?? "",
    });
    setInternalNote(item.internalNote ?? "");
    setSuccess(false);
    setError("");
  }
  async function resetToLatest() {
    if (dirty && !window.confirm(t.confirmReload)) return;
    setBusy(true);
    const latestItems = await onSaved();
    const latest = latestItems?.find((candidate) => candidate.id === item.id);
    if (latest) {
      setBinding({
        revision: latest.revision,
        submittedRevision: latest.submittedRevision,
        internalNote: latest.internalNote ?? "",
      });
      setPublicNote("");
      setInternalNote(latest.internalNote ?? "");
      setAction("needs_changes");
      setConflict(false);
      setError("");
      setSuccess(false);
    }
    setBusy(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stale || busy || success) return;
    setBusy(true);
    setError("");
    try {
      await eventRequest(`/review/${item.id}`, "POST", {
        revision: binding.revision,
        submittedRevision: binding.submittedRevision,
        action,
        publicNote,
        internalNote,
      });
      setSuccess(true);
      setPublicNote("");
      setAction("needs_changes");
      setBinding((previous) => ({ ...previous, internalNote }));
      await onSaved();
    } catch (error) {
      if (
        error instanceof EventApiError &&
        error.code === "REVISION_CONFLICT"
      ) {
        setConflict(true);
        setError(t.conflict);
      } else setError(errorText(error, language));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="ev-panel ev-review-card">
      <div className="ev-section-title">
        <h2>{item.registration.displayName}</h2>
        <span className="ev-email">{item.registration.email}</span>
      </div>
      <Status data={item} />
      {item.submittedAt && (
        <p className="ev-help">
          {t.submissionDate}:{" "}
          {dateText(item.submittedAt, language, eventConfig.timeZone)}
        </p>
      )}
      {item.official && (
        <MaterialPreview payload={item.official} assets={item.assets} />
      )}
      <dl>
        <dt>{t.feedback}</dt>
        <dd className="ev-prewrap">{item.publicNote || "—"}</dd>
        <dt>{t.internalNote}</dt>
        <dd className="ev-prewrap">{item.internalNote || "—"}</dd>
      </dl>
      {(item.status !== "processed" || (stale && dirty)) && (
        <form className="ev-form" onSubmit={submit}>
          <fieldset
            disabled={busy || stale || success || item.status === "processed"}
          >
            <label htmlFor={`review-public-${item.id}`}>
              {t.publicNote}
              <textarea
                id={`review-public-${item.id}`}
                required
                value={publicNote}
                maxLength={5000}
                onChange={(e) => setPublicNote(e.target.value)}
                rows={3}
              />
            </label>
            <label htmlFor={`review-internal-${item.id}`}>
              {t.internalNote}
              <textarea
                id={`review-internal-${item.id}`}
                value={internalNote}
                maxLength={5000}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={2}
              />
            </label>
            <div className="ev-radio-group">
              {(["needs_changes", "accepted", "rejected"] as const).map(
                (value) => (
                  <label
                    className="ev-check"
                    key={value}
                    htmlFor={`review-${item.id}-${value}`}
                  >
                    <input
                      id={`review-${item.id}-${value}`}
                      type="radio"
                      name={`review-${item.id}`}
                      value={value}
                      checked={action === value}
                      onChange={() => setAction(value)}
                    />
                    <span>{t[value]}</span>
                  </label>
                ),
              )}
            </div>
            <button className="button primary" type="submit">
              {busy ? t.saving : t.reviewAction}
            </button>
          </fieldset>
        </form>
      )}
      {stale && (dirty || conflict) && (
        <>
          {!error && (
            <p className="error" role="alert">
              {t.conflict}
            </p>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void resetToLatest()}
          >
            {t.reload}
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="ev-success" role="status">
          {t.successReview}
        </p>
      )}
    </article>
  );
}
export function ReviewDashboard({ initial }: { initial: ReviewItem[] }) {
  const { language, t, eventRequest } = useEventText();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await eventRequest<{ items: ReviewItem[] }>("/review");
      setItems(data.items);
      return data.items;
    } catch (error) {
      setError(errorText(error, language));
      return null;
    } finally {
      setBusy(false);
    }
  }
  function reload() {
    void load();
  }
  return (
    <EventShell signedIn review>
      <div className="ev-section-title">
        <h1>{t.review}</h1>
        <button className="button secondary" disabled={busy} onClick={reload}>
          {busy ? t.saving : t.refresh}
        </button>
      </div>
      <p className="ev-help">{t.internalNote}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items.length ? (
        items.map((item) => (
          <ReviewCard key={item.id} item={item} onSaved={load} />
        ))
      ) : (
        <section className="ev-panel">
          <p>{t.reviewEmpty}</p>
        </section>
      )}
    </EventShell>
  );
}
