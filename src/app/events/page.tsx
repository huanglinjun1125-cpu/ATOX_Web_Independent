import { getCurrentUser } from "@/modules/auth/server";
import { getBoard } from "@/modules/event-board/server";
import { BoardView } from "@/modules/event-board/components/board-view";
import "@/modules/event-board/styles.css";

export const dynamic = "force-dynamic";
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const read = (name: string) =>
    typeof query[name] === "string" ? query[name] : undefined;
  const filters = { q: read("q"), year: read("year"), stage: read("stage") };
  const user = await getCurrentUser();
  return (
    <BoardView initial={await getBoard()} signedIn={!!user} filters={filters} />
  );
}
