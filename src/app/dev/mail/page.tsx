import { notFound } from "next/navigation";
import { isDevMailEnabled, listDevMails } from "@/modules/auth/server";
import { MailView } from "@/modules/auth/components/mail-view";
export const dynamic = "force-dynamic";
export default async function DevMailPage() {
  if (!isDevMailEnabled()) notFound();
  const mails = await listDevMails();
  return (
    <MailView
      mails={mails.map((mail) => ({
        ...mail,
        createdAt: mail.createdAt.toISOString(),
      }))}
    />
  );
}
