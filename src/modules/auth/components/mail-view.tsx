"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
type Mail = {
  id: string;
  email: string;
  language: string;
  subject: string;
  body: string;
  createdAt: string;
};
export function MailView({ mails }: { mails: Mail[] }) {
  const { language, t } = useLanguage();
  const router = useRouter();
  return (
    <div className="site">
      <Header />
      <main className="mail-main">
        <div className="eyebrow purple-text">DEVELOPMENT ONLY</div>
        <h1>{t.mailTitle}</h1>
        <p className="lead">{t.mailIntro}</p>
        <div className="mail-actions">
          <button className="button secondary" onClick={() => router.refresh()}>
            {t.refresh} ↻
          </button>
          <Link href="/login" className="back-link">
            {t.mailBack} ↗
          </Link>
        </div>
        {mails.length === 0 ? (
          <div className="empty-state">{t.empty}</div>
        ) : (
          <div className="mail-list">
            {mails.map((mail) => (
              <article className="mail-card" key={mail.id}>
                <div className="mail-meta">
                  <strong>{mail.email}</strong>
                  <time dateTime={mail.createdAt}>
                    {new Date(mail.createdAt).toLocaleString(
                      language === "zh" ? "zh-CN" : "en-US",
                    )}
                  </time>
                </div>
                <h2>{mail.subject}</h2>
                <pre>{mail.body}</pre>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
