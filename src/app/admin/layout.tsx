import { AdminChrome } from "@/modules/admin/components/chrome";
import "@/modules/admin/styles.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminChrome>{children}</AdminChrome>;
}
