import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language-provider";
import { SiteNavigationProvider } from "@/components/site-navigation-provider";
import { isTicketingEnabled } from "@/modules/ticketing/policy";
import "./globals.css";
import "@/components/site-header.css";
import "@/components/brand.css";
export const metadata: Metadata = {
  title: "ATOX 爱拓无限 — 连接青年与 AI 创造",
  description: "ATOX AI 青年生态品牌。通过技术、产品与全球社区，让想法走向实践。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <SiteNavigationProvider ticketingEnabled={isTicketingEnabled()}>
          <LanguageProvider>{children}</LanguageProvider>
        </SiteNavigationProvider>
      </body>
    </html>
  );
}
