"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
import { logout as signOut } from "../client";
export function AccountView({
  email,
  createdAt,
}: {
  email: string;
  createdAt: string;
}) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    setBusy(true);
    setError(false);
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <div className="site">
      <Header signedIn />
      <main className="account-main">
        <div className="eyebrow purple-text">YOUR SPACE / 01</div>
        <h1>{t.accountTitle}</h1>
        <p className="lead">{t.accountIntro}</p>
        <section className="profile-card">
          <div className="avatar">{email.slice(0, 1).toUpperCase()}</div>
          <div className="profile-info">
            <h2>{email}</h2>
            <span className="verified">✓ {t.verified}</span>
            <p>
              {t.joined} ·{" "}
              {new Date(createdAt).toLocaleDateString(
                language === "zh" ? "zh-CN" : "en-US",
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                },
              )}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => void logout()}
            disabled={busy}
          >
            {busy ? t.loggingOut : t.logout} ↗
          </button>
        </section>
        <p style={{ marginBottom: 24 }}>
          <Link className="button primary" href="/events/demo">
            {language === "zh"
              ? "进入演示活动 · 报名与材料提交"
              : "Demo event · Registration & materials"}{" "}
            ↗
          </Link>
        </p>
        {error && (
          <p role="alert" className="error">
            {t.network}
          </p>
        )}
        <div className="journey-grid account-modules">
          {[t.registration, t.submission, t.projects].map((title, i) => (
            <section key={title} className="journey-card">
              <span className="index">0{i + 1}</span>
              <h3>{title}</h3>
              {i < 2 ? (
                <Link
                  href={
                    i === 0 ? "/events/demo/register" : "/events/demo/materials"
                  }
                >
                  {language === "zh" ? "进入演示活动" : "Open demo event"} ↗
                </Link>
              ) : (
                <>
                  <p>{t.pending}</p>
                  <span className="status">{t.soon}</span>
                </>
              )}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
