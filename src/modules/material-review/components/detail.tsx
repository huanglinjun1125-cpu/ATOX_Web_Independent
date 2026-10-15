"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adminRequest, AdminApiError } from "@/modules/admin/client";
import type { AdminIdentity } from "@/modules/admin/contracts";
import {
  AccessDenied,
  AdminDialog,
  AdminShell,
  dateText,
} from "@/modules/admin/components/shared";
import type {
  DecisionInput,
  MaterialReviewDetail,
  MaterialReviewSnapshot,
} from "../contracts";
import { OfficialMaterial, Registration, useReviewText } from "./shared";

function Snapshot({ value }: { value: MaterialReviewSnapshot | null }) {
  const { t } = useReviewText();
  if (!value) return <span>{t.none}</span>;
  return (
    <span>
      {t[value.status === "approved" ? "accepted" : value.status]} ·{" "}
      {t.revision} {value.revision} / {t.submittedRevision}{" "}
      {value.submittedRevision}
      {value.reason && (
        <span className="mr-history-note">
          {t.publicNote}: {value.reason}
        </span>
      )}
      {value.internalNote && (
        <span className="mr-history-note">
          {t.internalNote}: {value.internalNote}
        </span>
      )}
    </span>
  );
}
export function ReviewDetail({
  identity,
  submissionId,
}: {
  identity: AdminIdentity;
  submissionId: string;
}) {
  const { t, language } = useReviewText();
  const [material, setMaterial] = useState<MaterialReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [decision, setDecision] = useState<DecisionInput["action"]>("approved");
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<
    "saved" | "conflict" | "uncertain" | "checked" | null
  >(null);
  const [confirmation, setConfirmation] = useState<
    "decision" | "reload" | null
  >(null);
  const apiPath = `/materials/${encodeURIComponent(submissionId)}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    adminRequest<{ material: MaterialReviewDetail }>(
      apiPath,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (active) {
          setMaterial(value.material);
          setInternalNote(value.material.internalNote ?? "");
          setError(null);
        }
      })
      .catch((value) => {
        if (active) setError(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [apiPath]);
  const dirty =
    reason !== "" ||
    internalNote !== (material?.internalNote ?? "") ||
    decision !== "approved";
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  if (error instanceof AdminApiError && [401, 403].includes(error.status))
    return <AccessDenied expired={error.status === 401} />;
  function errorText() {
    if (!(error instanceof AdminApiError)) return t.network;
    if (error.status === 404) return t.notFound;
    if (error.code === "INVALID_INPUT") return t.invalid;
    if (error.code === "NOT_PENDING") return t.notPending;
    if (error.code === "REVISION_CONFLICT") return t.conflict;
    return t.unavailable;
  }
  async function readLatest() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await adminRequest<{ material: MaterialReviewDetail }>(
        apiPath,
      );
      setMaterial(value.material);
      setReason("");
      setInternalNote(value.material.internalNote ?? "");
      setDecision("approved");
      setLocked(false);
      setNotice("checked");
    } catch (value) {
      setError(value);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setLoading(false);
      setConfirmation(null);
    }
  }
  async function submit() {
    if (
      busyRef.current ||
      locked ||
      !material ||
      material.status !== "pending" ||
      (decision === "rejected" && !reason.trim())
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const value = await adminRequest<{ material: MaterialReviewDetail }>(
        apiPath + "/decision",
        "POST",
        {
          revision: material.revision,
          submittedRevision: material.submittedRevision,
          action: decision,
          reason,
          internalNote,
        } satisfies DecisionInput,
      );
      setMaterial(value.material);
      setReason("");
      setInternalNote(value.material.internalNote ?? "");
      setDecision("approved");
      setNotice("saved");
    } catch (value) {
      setError(value);
      if (
        value instanceof AdminApiError &&
        ["REVISION_CONFLICT", "NOT_PENDING"].includes(value.code)
      ) {
        setLocked(true);
        setNotice("conflict");
      } else if (!(value instanceof AdminApiError) || value.status >= 500) {
        setLocked(true);
        setNotice("uncertain");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setConfirmation(null);
    }
  }
  return (
    <AdminShell identity={identity}>
      <Link href="/admin/materials" className="mr-back">
        ← {t.back}
      </Link>
      <div className="adm-heading">
        <h1>{t.title}</h1>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => setConfirmation("reload")}
        >
          {t.reload}
        </button>
      </div>
      {notice && (
        <p
          className={locked ? "adm-error" : "adm-success"}
          role={locked ? "alert" : "status"}
        >
          {t[notice]}
        </p>
      )}
      {error != null &&
        !(
          notice === "conflict" &&
          error instanceof AdminApiError &&
          error.code === "REVISION_CONFLICT"
        ) && (
          <p className="adm-error" role="alert">
            {errorText()}
          </p>
        )}
      {loading && <p role="status">{t.loading}</p>}
      {!material && !loading && (
        <button type="button" disabled={busy} onClick={() => void readLatest()}>
          {t.retry}
        </button>
      )}
      {material && (
        <>
          <section className="adm-panel">
            <div className="adm-heading">
              <h2>{material.projectName}</h2>
              <span className="adm-badge">
                {
                  t[
                    material.status === "approved"
                      ? "accepted"
                      : material.status
                  ]
                }
              </span>
            </div>
            <p>{material.eventName[language]}</p>
            <p className="mr-version">
              {t.revision} {material.revision} / {t.submittedRevision}{" "}
              {material.submittedRevision}
            </p>
            {material.submittedAt && (
              <p className="adm-muted">
                {t.submitted}: {dateText(material.submittedAt, language)}
              </p>
            )}
            {material.reason && (
              <p className="mr-prewrap">
                {t.publicNote}: {material.reason}
              </p>
            )}
          </section>
          <Registration value={material.registration} />
          <OfficialMaterial
            value={material.official}
            assets={material.assets}
            submissionId={material.id}
            trackName={material.official.trackId}
          />
          <section className="adm-panel">
            <h2>{t.decision}</h2>
            <p className="adm-muted">{t.reasonRequired}</p>
            <p className="adm-muted">{t.optionalNote}</p>
            {material.status === "pending" || locked ? (
              <form
                className="mr-review"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    !busyRef.current &&
                    !locked &&
                    (decision !== "rejected" || reason.trim())
                  )
                    setConfirmation("decision");
                }}
              >
                <fieldset disabled={busy || locked}>
                  <div className="mr-radio">
                    {(["approved", "rejected"] as const).map((action) => (
                      <label key={action}>
                        <input
                          type="radio"
                          name="mr-action"
                          value={action}
                          checked={decision === action}
                          onChange={() => setDecision(action)}
                        />
                        {t[action === "approved" ? "accepted" : action]}
                      </label>
                    ))}
                  </div>
                  <label htmlFor="mr-reason">
                    {t.publicNote}
                    <textarea
                      id="mr-reason"
                      maxLength={5000}
                      required={decision === "rejected"}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                    />
                  </label>
                  <label htmlFor="mr-internal">
                    {t.internalNote}
                    <textarea
                      id="mr-internal"
                      maxLength={5000}
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      rows={3}
                    />
                  </label>
                  <button
                    type="submit"
                    className="adm-button"
                    disabled={decision === "rejected" && !reason.trim()}
                  >
                    {busy ? t.loading : t.submit}
                  </button>
                </fieldset>
              </form>
            ) : (
              <>
                <p>{t.processed}</p>
                {material.internalNote && (
                  <p className="mr-prewrap">
                    {t.internalNote}: {material.internalNote}
                  </p>
                )}
              </>
            )}
          </section>
          <section className="mr-history" aria-labelledby="mr-history-title">
            <h2 id="mr-history-title">{t.history}</h2>
            {material.history.length === 0 && (
              <p className="adm-muted">{t.historyEmpty}</p>
            )}
            {material.history.map((item) => (
              <article
                className="adm-panel"
                key={item.id}
                data-material-audit-id={item.id}
              >
                <div className="adm-heading">
                  <h3 className="mr-record-title">
                    {item.action.endsWith("approved")
                      ? t.accepted
                      : item.action.endsWith("rejected") ||
                          item.action.endsWith("needs_changes")
                        ? t.rejected
                        : t.historical}
                  </h3>
                  <time dateTime={item.createdAt}>
                    {dateText(item.createdAt, language)}
                  </time>
                </div>
                <dl className="adm-details">
                  <dt>{t.actor}</dt>
                  <dd>{item.actor.label}</dd>
                  <dt>{t.before}</dt>
                  <dd>
                    <Snapshot value={item.before} />
                  </dd>
                  <dt>{t.after}</dt>
                  <dd>
                    <Snapshot value={item.after} />
                  </dd>
                </dl>
              </article>
            ))}
          </section>
        </>
      )}
      {confirmation && (
        <AdminDialog
          title={confirmation === "reload" ? t.reload : t.confirmTitle}
          busy={busy}
          close={() => setConfirmation(null)}
        >
          <div className="mr-confirm">
            {confirmation === "reload" ? (
              <p>{t.reloadConfirm}</p>
            ) : (
              <>
                <p>{t.confirmHelp}</p>
                <p>
                  {material?.projectName} · {material?.registration.email}
                </p>
                <p>
                  {t.outcome}:{" "}
                  {t[decision === "approved" ? "accepted" : "rejected"]}
                </p>
                <p>
                  {t.publicNote}: {reason || "—"}
                </p>
                <p>
                  {t.internalNote}: {internalNote || "—"}
                </p>
                <p className="mr-version">
                  {t.revision} {material?.revision} / {t.submittedRevision}{" "}
                  {material?.submittedRevision}
                </p>
              </>
            )}
          </div>
          <div className="adm-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="adm-button"
              disabled={busy}
              onClick={() =>
                void (confirmation === "reload" ? readLatest() : submit())
              }
            >
              {busy
                ? t.loading
                : confirmation === "reload"
                  ? t.reload
                  : t.confirm}
            </button>
          </div>
        </AdminDialog>
      )}
    </AdminShell>
  );
}
