"use client";
import { useEffect, useRef, useState } from "react";
import type {
  AdministratorDto,
  AdminIdentity,
  AdminPage,
  AdminRole,
} from "../contracts";
import { adminRequest, AdminApiError } from "../client";
import {
  AccessDenied,
  AdminDialog,
  AdminShell,
  Pagination,
  adminErrorText,
  dateText,
  useAdminText,
} from "./shared";

type FormState = {
  email: string;
  role: AdminRole;
  enabled: boolean;
  original: AdministratorDto | null;
};
type Confirmation = "grant" | "update" | "reload";
const emptyForm: FormState = {
  email: "",
  role: "operator",
  enabled: true,
  original: null,
};

export function AdministratorsView({ identity }: { identity: AdminIdentity }) {
  const { language, t } = useAdminText();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AdminPage<AdministratorDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<
    "saved" | "checked" | "conflict" | "uncertain" | null
  >(null);
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    adminRequest<AdminPage<AdministratorDto>>(
      `/administrators?page=${page}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (active) {
          setData(value);
          setError(null);
        }
      })
      .catch((reason) => {
        if (active) setError(reason);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const reload = () => {
      setLoading(true);
      setRefresh((value) => value + 1);
    };
    window.addEventListener("focus", reload);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", reload);
    };
  }, [page, refresh]);
  if (
    error instanceof AdminApiError &&
    (error.status === 401 || error.status === 403)
  )
    return <AccessDenied expired={error.status === 401} />;
  const isSelf = form.original?.userId === identity.userId;
  const selfInvalid = isSelf && (!form.enabled || form.role !== "super_admin");
  const changed =
    !form.original ||
    form.role !== form.original.role ||
    form.enabled !== form.original.enabled;
  function reloadList(target = page) {
    setLoading(true);
    setPage(target);
    setRefresh((value) => value + 1);
  }
  function edit(item: AdministratorDto) {
    if (busy || locked) return;
    setForm({
      email: item.email,
      role: item.role,
      enabled: item.enabled,
      original: item,
    });
    setNotice(null);
    setError(null);
    document.getElementById("adm-access-form")?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    document.getElementById("adm-role")?.focus({ preventScroll: true });
  }
  async function readLatest() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let target: AdministratorDto | undefined;
      let targetPage = 1;
      // Reconcile an unknown write outcome from current records before another write.
      while (true) {
        const latest = await adminRequest<AdminPage<AdministratorDto>>(
          `/administrators?page=${targetPage}`,
        );
        if (targetPage === page) setData(latest);
        target = latest.items.find((item) =>
          form.original
            ? item.userId === form.original.userId
            : item.email === form.email.trim().toLowerCase(),
        );
        if (target || targetPage >= latest.totalPages) break;
        targetPage += 1;
      }
      if (form.original && !target)
        throw new AdminApiError("ADMIN_NOT_FOUND", 404);
      setForm(
        target
          ? {
              email: target.email,
              role: target.role,
              enabled: target.enabled,
              original: target,
            }
          : { ...emptyForm, email: form.email },
      );
      setLocked(false);
      setNotice("checked");
      setConfirmation(null);
      reloadList();
    } catch (reason) {
      setError(reason);
      setConfirmation(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (locked || busyRef.current || selfInvalid) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const value = form.original
        ? await adminRequest<{ administrator: AdministratorDto }>(
            `/administrators/${encodeURIComponent(form.original.userId)}`,
            "PATCH",
            {
              role: form.role,
              enabled: form.enabled,
              revision: form.original.revision,
            },
          )
        : await adminRequest<{ administrator: AdministratorDto }>(
            "/administrators",
            "POST",
            { email: form.email, role: form.role },
          );
      setForm({
        email: value.administrator.email,
        role: value.administrator.role,
        enabled: value.administrator.enabled,
        original: value.administrator,
      });
      setNotice("saved");
      reloadList();
    } catch (reason) {
      setError(reason);
      if (
        reason instanceof AdminApiError &&
        reason.code === "REVISION_CONFLICT"
      ) {
        setLocked(true);
        setNotice("conflict");
      } else if (!(reason instanceof AdminApiError) || reason.status >= 500) {
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
      <div className="adm-heading">
        <h1>{t.administrators}</h1>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => reloadList()}
        >
          {t.refresh}
        </button>
      </div>
      {error != null && !notice && (
        <p className="adm-error" role="alert">
          {adminErrorText(error, language)}
        </p>
      )}
      {notice && (
        <p
          className={locked ? "adm-error" : "adm-success"}
          role={locked ? "alert" : "status"}
        >
          {t[notice]}
        </p>
      )}
      {error != null &&
        notice &&
        !(
          error instanceof AdminApiError && error.code === "REVISION_CONFLICT"
        ) && (
          <p className="adm-error" role="alert">
            {adminErrorText(error, language)}
          </p>
        )}
      <section className="adm-panel" id="adm-access-form">
        <h2>{form.original ? t.editing : t.grant}</h2>
        <p className="adm-muted">
          {form.original
            ? `${t.revision} ${form.original.revision}`
            : t.grantHelp}
        </p>
        <form
          className="adm-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked && !busy && !selfInvalid && changed)
              setConfirmation(form.original ? "update" : "grant");
          }}
        >
          <fieldset disabled={busy || locked}>
            <label htmlFor="adm-email">
              {t.email}
              <input
                id="adm-email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                readOnly={Boolean(form.original)}
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label htmlFor="adm-role">
              {t.role}
              <select
                id="adm-role"
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as AdminRole })
                }
              >
                <option value="operator" disabled={isSelf}>
                  {t.operator}
                </option>
                <option value="super_admin">{t.super_admin}</option>
              </select>
            </label>
            {form.original && (
              <label className="adm-checkbox">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={isSelf}
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                />
                {t.enabled}
              </label>
            )}
            {isSelf && <p className="adm-muted">{t.self}</p>}
            <div className="adm-actions">
              <button
                className="adm-button"
                type="submit"
                disabled={!changed || selfInvalid}
              >
                {busy ? t.loading : form.original ? t.save : t.grant}
              </button>
              {form.original && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setNotice(null);
                    setError(null);
                  }}
                >
                  {t.cancel}
                </button>
              )}
            </div>
          </fieldset>
        </form>
        {locked && (
          <button
            className="adm-button secondary"
            type="button"
            disabled={busy}
            onClick={() => setConfirmation("reload")}
          >
            {t.reload}
          </button>
        )}
      </section>
      {loading && <p role="status">{t.loading}</p>}
      {data?.items.length === 0 && <p>{t.empty}</p>}
      <div className="adm-records">
        {data?.items.map((item) => (
          <article
            className="adm-panel adm-admin-card"
            key={item.userId}
            data-admin-user-id={item.userId}
          >
            <div className="adm-heading">
              <h2>{item.email}</h2>
              <span className="adm-badge">{t[item.role]}</span>
            </div>
            <dl className="adm-details">
              <dt>{t.status}</dt>
              <dd>{item.enabled ? t.enabled : t.disabled}</dd>
              <dt>{t.updated}</dt>
              <dd>{dateText(item.updatedAt, language)}</dd>
              <dt>{t.actor}</dt>
              <dd>
                {item.updatedBy.label} ·{" "}
                {item.updatedBy.source === "bootstrap"
                  ? t.sourceBootstrap
                  : t.sourceWeb}
              </dd>
              <dt>{t.revision}</dt>
              <dd>{item.revision}</dd>
            </dl>
            <button
              type="button"
              disabled={busy || locked}
              onClick={() => edit(item)}
            >
              {t.edit}
            </button>
          </article>
        ))}
      </div>
      {data && (
        <Pagination data={data} busy={loading || busy} change={reloadList} />
      )}
      {confirmation && (
        <AdminDialog
          title={confirmation === "reload" ? t.reload : t.confirmTitle}
          busy={busy}
          close={() => setConfirmation(null)}
        >
          {confirmation === "reload" ? (
            <p>{t.reloadConfirm}</p>
          ) : (
            <>
              <p>{t.confirmHelp}</p>
              <p className="adm-confirm-email">{form.email}</p>
              {form.original && (
                <p>
                  {t.before}: {t[form.original.role]} ·{" "}
                  {form.original.enabled ? t.enabled : t.disabled}
                </p>
              )}
              <p>
                {t.after}: {t[form.role]} ·{" "}
                {form.enabled ? t.enabled : t.disabled}
              </p>
            </>
          )}
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
