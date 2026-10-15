import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/server";
import { ProjectSubmissionPlaceholder } from "@/modules/project-board/components/board-view";
import "@/modules/project-board/styles.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "提交项目 · ATOX",
  description: "项目提交即将开放，未来支持独立创作与活动项目。",
};
export default async function SubmitProjectPage() {
  const user = await getCurrentUser();
  return <ProjectSubmissionPlaceholder signedIn={Boolean(user)} />;
}
