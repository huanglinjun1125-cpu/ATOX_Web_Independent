"use client";
import { usePathname } from "next/navigation";
import { Header, Footer } from "@/components/site-shell";
export function AdminChrome({ children }: { children: React.ReactNode }) {
  const preview = usePathname().endsWith("/preview");
  return (
    <div className="site admin-module">
      {preview ? (
        children
      ) : (
        <>
          <Header signedIn />
          <main className="adm-main">{children}</main>
          <Footer />
        </>
      )}
    </div>
  );
}
