import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { AccountView } from "@/modules/auth/components/account-view";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AccountView email={user.email} createdAt={user.createdAt.toISOString()} />
  );
}
