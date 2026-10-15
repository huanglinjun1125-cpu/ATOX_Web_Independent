"use client";
import { useLanguage } from "./language-provider";
import { SiteHeader } from "./site-header";
// Legacy display props remain source-compatible; all pages use the same navigation.
export function Header({
  signedIn = false,
}: {
  signedIn?: boolean;
  variant?: "simple" | "homepage";
  projectSubmission?: boolean;
}) {
  return <SiteHeader signedIn={signedIn} />;
}
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="footer">
      <span>ATOX / {t.footer}</span>
      <span>
        IDEAS INTO REALITY <i>✳</i>
      </span>
    </footer>
  );
}
