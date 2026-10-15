"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminRequest, AdminApiError } from "@/modules/admin/client";
import type { AdminIdentity, AdminPage } from "@/modules/admin/contracts";
import {
  AccessDenied,
  AdminShell,
  Pagination,
  dateText,
} from "@/modules/admin/components/shared";
import type { MaterialReviewItem, ReviewStatus } from "../contracts";
import type { ContentRecord } from "@/modules/content-management/contracts";
import type { EventDefinition } from "@/modules/event-board/contracts";
import { useReviewText } from "./shared";

export type ReviewEventOption = {
  id: string;
  name: { zh: string; en: string };
};
export type ListFilters = {
  eventId: string;
  status: ReviewStatus | "";
  page: number;
};
export function ReviewList({
  identity,
  events,
  initial,
}: {
  identity: AdminIdentity;
  events: ReviewEventOption[];
  initial: ListFilters;
}) {
  const { t, language } = useReviewText();
  const [filters, setFilters] = useState(initial);
  const [eventOptions, setEventOptions] = useState(events);
  const [applied, setApplied] = useState(initial);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AdminPage<MaterialReviewItem> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    function restoreFilters() {
      const query = new URLSearchParams(window.location.search);
      const rawStatus = query.get("status") ?? "";
      const rawPage = query.get("page") ?? "1";
      const restored: ListFilters = {
        eventId: query.get("eventId") ?? "",
        status: ["pending", "approved", "rejected"].includes(rawStatus)
          ? (rawStatus as ReviewStatus)
          : "",
        page:
          /^\d+$/.test(rawPage) && Number(rawPage) <= 1_000_000
            ? Math.max(1, Number(rawPage))
            : 1,
      };
      setFilters(restored);
      setApplied(restored);
      setBusy(true);
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams({ page: String(applied.page) });
    if (applied.eventId) query.set("eventId", applied.eventId);
    if (applied.status) query.set("status", applied.status);
    Promise.all([
      adminRequest<AdminPage<MaterialReviewItem>>(
        `/materials?${query}`,
        "GET",
        undefined,
        controller.signal,
      ),
      adminRequest<{ items: ContentRecord<EventDefinition>[] }>(
        "/content/events",
        "GET",
        undefined,
        controller.signal,
      ),
    ])
      .then(([value, managed]) => {
        if (active) {
          setData(value);
          setEventOptions(
            managed.items.map((record) => ({
              id: record.id,
              name: record.draft.name,
            })),
          );
          setError(null);
        }
      })
      .catch((reason) => {
        if (active) setError(reason);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    const onFocus = () => {
      setBusy(true);
      setRefresh((value) => value + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [applied, refresh]);
  if (error instanceof AdminApiError && [401, 403].includes(error.status))
    return <AccessDenied expired={error.status === 401} />;
  function apply(value: ListFilters) {
    setBusy(true);
    setApplied(value);
    setFilters(value);
    const query = new URLSearchParams();
    if (value.eventId) query.set("eventId", value.eventId);
    if (value.status) query.set("status", value.status);
    if (value.page > 1) query.set("page", String(value.page));
    window.history.replaceState(
      null,
      "",
      "/admin/materials" + (query.size ? `?${query}` : ""),
    );
  }
  return (
    <AdminShell identity={identity}>
      <div className="adm-heading">
        <h1>{t.title}</h1>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRefresh((value) => value + 1);
          }}
        >
          {t.refresh}
        </button>
      </div>
      <p className="adm-muted">{t.introduction}</p>
      <form
        className="mr-filters"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...filters, page: 1 });
        }}
      >
        <label htmlFor="mr-event">
          {t.event}
          <select
            id="mr-event"
            value={filters.eventId}
            onChange={(event) =>
              setFilters({ ...filters, eventId: event.target.value })
            }
          >
            <option value="">{t.allEvents}</option>
            {eventOptions.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name[language]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="mr-status">
          {t.state}
          <select
            id="mr-status"
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value as ListFilters["status"],
              })
            }
          >
            <option value="">{t.allStates}</option>
            {(["pending", "approved", "rejected"] as const).map((state) => (
              <option key={state} value={state}>
                {t[state === "approved" ? "accepted" : state]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="adm-button" disabled={busy}>
          {t.filter}
        </button>
      </form>
      {error != null && (
        <p className="adm-error" role="alert">
          {error instanceof AdminApiError && error.status === 404
            ? t.notFound
            : t.network}
        </p>
      )}
      {busy && <p role="status">{t.loading}</p>}
      {data?.items.length === 0 && <p className="adm-panel">{t.empty}</p>}
      <div className="adm-records">
        {data?.items.map((item) => (
          <article
            className="adm-panel"
            key={item.id}
            data-material-id={item.id}
          >
            <div className="adm-heading">
              <h2>{item.projectName}</h2>
              <span className="adm-badge">
                {t[item.status === "approved" ? "accepted" : item.status]}
              </span>
            </div>
            <dl className="adm-details">
              <dt>{t.event}</dt>
              <dd>{item.eventName[language]}</dd>
              <dt>{t.participant}</dt>
              <dd>
                {item.registration.displayName} · {item.registration.email}
              </dd>
              <dt>{t.submitted}</dt>
              <dd>
                {item.submittedAt ? dateText(item.submittedAt, language) : "—"}
              </dd>
              <dt>{t.submittedRevision}</dt>
              <dd>{item.submittedRevision}</dd>
            </dl>
            <Link
              className="adm-button secondary"
              href={`/admin/materials/${encodeURIComponent(item.id)}`}
            >
              {t.review} ↗
            </Link>
          </article>
        ))}
      </div>
      {data && (
        <Pagination
          data={data}
          busy={busy}
          change={(page) => apply({ ...applied, page })}
        />
      )}
    </AdminShell>
  );
}
