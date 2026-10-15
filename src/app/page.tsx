import type { Metadata } from "next";
import { HomeView } from "@/modules/homepage/components/home-view";
import { readPublishedHomepage } from "@/modules/content-management/server";
import { getCurrentUser } from "@/modules/auth/server";
import "@/modules/homepage/styles.css";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readPublishedHomepage();
  return {
    title: content.metadata.title.zh,
    description: content.metadata.description.zh,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const year = Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Shanghai",
    }).format(new Date()),
  );
  return (
    <HomeView
      signedIn={Boolean(user)}
      year={year}
      content={await readPublishedHomepage()}
    />
  );
}
