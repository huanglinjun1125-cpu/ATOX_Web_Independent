import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/server";
import { EventView } from "@/modules/event-experience/components/event-view";
import { LanguageProvider } from "@/components/language-provider";
import "@/modules/homepage/styles.css";
import "@/modules/event-experience/styles.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "ATOX × TAMAPUSC at APU — Malaysia AI & MVP Hackathon 2026",
  description:
    "Build AI That Matters. Proposed three-day hybrid hackathon, 4–6 December 2026. Online kick-off, campus collaboration and hybrid finals. Planning in progress.",
  openGraph: {
    title: "Build AI That Matters — ATOX × TAMAPUSC at APU",
    description: "4–6 December 2026 · Hybrid · Malaysia · Planning in progress",
    images: [
      {
        url: "/event-covers/malaysia-2026.svg",
        width: 1200,
        height: 630,
        alt: "ATOX Malaysia AI and MVP Hackathon 2026",
      },
    ],
  },
};
export default async function MalaysiaPage() {
  const user = await getCurrentUser();
  return (
    <LanguageProvider defaultLanguage="en">
      <EventView signedIn={!!user} year={2026} />
    </LanguageProvider>
  );
}
