import type { BoardDto } from "./contracts";
export async function fetchBoard(): Promise<BoardDto> {
  const response = await fetch("/api/events", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load events");
  return response.json() as Promise<BoardDto>;
}
