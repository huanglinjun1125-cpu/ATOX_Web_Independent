import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { ReviewDetail } from "@/modules/material-review/components/detail";
import "@/modules/material-review/styles.css";
export const dynamic = "force-dynamic";
export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const identity = await requireAdminPage(
    `/admin/materials/${encodeURIComponent(submissionId)}`,
    "admin:materials",
  );
  return identity ? (
    <ReviewDetail
      key={submissionId}
      identity={identity}
      submissionId={submissionId}
    />
  ) : (
    <AccessDenied />
  );
}
