import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/server";
import { getProjects } from "@/modules/project-board/server";
import { ProjectBoardView } from "@/modules/project-board/components/board-view";
import "@/modules/project-board/styles.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "项目展区 · ATOX",
  description: "发现作品与创作灵感，按分类和活动探索原创演示项目。",
};
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const value = (key: string) =>
    Array.isArray(query[key]) ? query[key][0] : query[key];
  const [user, initial] = await Promise.all([
    getCurrentUser(),
    getProjects({
      q: value("q"),
      category: value("category"),
      event: value("event"),
      page: value("page"),
    }),
  ]);
  return <ProjectBoardView initial={initial} signedIn={Boolean(user)} />;
}
