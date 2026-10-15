"use client";
import { useEffect, useState } from "react";
import type {
  AdminAuditDto,
  AdminIdentity,
  AdminPage,
  AdminSnapshot,
} from "../contracts";
import { adminRequest, AdminApiError } from "../client";
import {
  AccessDenied,
  AdminShell,
  Pagination,
  adminErrorText,
  dateText,
  useAdminText,
} from "./shared";

function Snapshot({ value }: { value: AdminSnapshot | null }) {
  const { t } = useAdminText();
  return value ? (
    <span>
      {value.email} · {t[value.role]} · {value.enabled ? t.enabled : t.disabled}{" "}
      · {t.revision} {value.revision}
    </span>
  ) : (
    <span>{t.none}</span>
  );
}
export function AuditView({ identity }: { identity: AdminIdentity }) {
  const { t, language } = useAdminText();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AdminPage<AdminAuditDto> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    adminRequest<AdminPage<AdminAuditDto>>(
      `/audit?page=${page}`,
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
        if (active) setBusy(false);
      });
    const reload = () => {
      setBusy(true);
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
  function reload(target: number) {
    setBusy(true);
    setPage(target);
    setRefresh((value) => value + 1);
  }
  return (
    <AdminShell identity={identity}>
      <div className="adm-heading">
        <h1>{t.audit}</h1>
        <button type="button" disabled={busy} onClick={() => reload(page)}>
          {t.refresh}
        </button>
      </div>
      <p className="adm-muted">{t.auditHelp}</p>
      {error != null && (
        <p className="adm-error" role="alert">
          {adminErrorText(error, language)}
        </p>
      )}
      {busy && <p role="status">{t.loading}</p>}
      {data?.items.length === 0 && <p className="adm-panel">{t.empty}</p>}
      <div className="adm-records">
        {data?.items.map((item) => (
          <article
            className="adm-panel"
            key={item.id}
            data-admin-audit-id={item.id}
          >
            <div className="adm-heading">
              <h2>
                {item.action === "grant" ? t.grantAction : t[item.action]}
              </h2>
              <time dateTime={item.createdAt}>
                {dateText(item.createdAt, language)}
              </time>
            </div>
            <dl className="adm-details">
              <dt>{t.actor}</dt>
              <dd>
                {item.actor.label} ·{" "}
                {item.actor.source === "bootstrap"
                  ? t.sourceBootstrap
                  : t.sourceWeb}
              </dd>
              <dt>{t.object}</dt>
              <dd>
                {item.targetEmail}
                <small>{item.targetUserId}</small>
              </dd>
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
      </div>
      {data && <Pagination data={data} busy={busy} change={reload} />}
    </AdminShell>
  );
}
