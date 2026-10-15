import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { getCurrentUser } from "@/modules/auth/server";
import { listManagedEvents } from "@/modules/content-management/server";
import type { EventDefinition } from "@/modules/event-board/contracts";
import {
  ReviewList,
  type ListFilters,
} from "@/modules/material-review/components/list";
import "@/modules/material-review/styles.css";
export const dynamic = "force-dynamic";
export default async function MaterialReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status =
    typeof query.status === "string" &&
    ["pending", "approved", "rejected"].includes(query.status)
      ? (query.status as ListFilters["status"])
      : "";
  const page =
    typeof query.page === "string" &&
    /^\d+$/.test(query.page) &&
    Number(query.page) <= 1_000_000
      ? Math.max(1, Number(query.page))
      : 1;
  const initial = {
    eventId: typeof query.eventId === "string" ? query.eventId : "",
    status,
    page,
  };
  const parameters = new URLSearchParams();
  if (initial.eventId) parameters.set("eventId", initial.eventId);
  if (initial.status) parameters.set("status", initial.status);
  if (initial.page > 1) parameters.set("page", String(initial.page));
  const identity = await requireAdminPage(
    "/admin/materials" + (parameters.size ? `?${parameters}` : ""),
    "admin:materials",
  );
  if (!identity) return <AccessDenied />;
  const user = await getCurrentUser();
  if (!user) return <AccessDenied expired />;
  const managedEvents = await listManagedEvents(user);
  return (
    <ReviewList
      identity={identity}
      events={managedEvents.items.map((record) => ({
        id: record.id,
        name: (record.draft as EventDefinition).name,
      }))}
      initial={initial}
    />
  );
}
