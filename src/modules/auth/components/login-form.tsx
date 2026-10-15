"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errors } from "@/lib/i18n";
import { useLanguage } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
import { AuthClientError, sendLoginCode, verifyLoginCode } from "../client";
export function LoginForm({
  devMailEnabled,
  returnTo = "/account",
}: {
  devMailEnabled: boolean;
  returnTo?: string;
}) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  function countdown(seconds: number) {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }
  async function request(action: "send-code" | "verify-code") {
    setBusy(true);
    setError("");
    try {
      if (action === "send-code") {
        const data = await sendLoginCode({ email: email.trim(), language });
        setEmail(email.trim());
        setStep("code");
        setCode("");
        countdown(data.retryAfter ?? 60);
      } else {
        await verifyLoginCode({ email: email.trim(), code });
        router.replace(returnTo);
        router.refresh();
      }
    } catch (failure) {
      setError(
        failure instanceof AuthClientError ? failure.code : "INTERNAL_ERROR",
      );
      if (failure instanceof AuthClientError && failure.retryAfter)
        countdown(failure.retryAfter);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="site">
      <Header />
      <main className="auth-main">
        <div className="auth-decoration" aria-hidden="true">
          ✳
        </div>
        <section className="auth-card">
          <Link className="back-link" href="/">
            ← {t.back}
          </Link>
          <div className="eyebrow purple-text">START SOMETHING GREAT</div>
          <h1>{t.welcome}</h1>
          <p className="muted auth-intro">{t.loginIntro}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(step === "email" ? "send-code" : "verify-code");
            }}
          >
            {step === "email" ? (
              <div className="field">
                <label htmlFor="email">{t.email}</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  disabled={busy}
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="sent-box">
                  <span>{t.sent}</span>
                  <strong>{email}</strong>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError("");
                    }}
                  >
                    {t.change} ↗
                  </button>
                </div>
                <div className="field">
                  <label htmlFor="code">{t.code}</label>
                  <input
                    className="code-input"
                    id="code"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    required
                    disabled={busy}
                    autoFocus
                  />
                </div>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error === "NETWORK"
                  ? t.network
                  : errors[language][error] || errors[language].INTERNAL_ERROR}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || (step === "email" && remaining > 0)}
              type="submit"
            >
              {busy
                ? step === "email"
                  ? t.sending
                  : t.verifying
                : step === "email"
                  ? remaining > 0
                    ? `${remaining}${t.seconds}`
                    : t.send
                  : t.verify}
              <span>↗</span>
            </button>
            {step === "code" && (
              <button
                type="button"
                className="resend"
                disabled={busy || remaining > 0}
                onClick={() => void request("send-code")}
              >
                {remaining > 0 ? `${remaining}${t.seconds}` : t.resend}
              </button>
            )}
          </form>
          <p className="security-note">◇ {t.safe}</p>
          {devMailEnabled && (
            <aside className="dev-note">
              <p>{t.previewNote}</p>
              <Link href="/dev/mail" target="_blank">
                {t.preview} ↗
              </Link>
            </aside>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
