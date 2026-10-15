import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { isTicketingEnabled } from "@/modules/ticketing/policy";
import { Header, Footer } from "@/components/site-shell";
import "@/modules/ticketing/styles.css";

export const dynamic = "force-dynamic";
export default async function TicketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isTicketingEnabled()) notFound();
  const user = await getCurrentUser();
  return (
    <div className="site ticketing-site">
      <Header signedIn={!!user} />
      {children}
      <Footer />
    </div>
  );
}
