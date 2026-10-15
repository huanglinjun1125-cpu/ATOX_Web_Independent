"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ParticipationDto,
  RegistrationDto,
  RegistrationInput,
  RegistrationRole,
} from "../contracts";
import { roleLabels } from "../i18n";
import { dateText, errorText, EventShell, useEventText } from "./shared";
export function RegistrationForm({
  email,
  participation,
  returnTo,
}: {
  email: string;
  participation: ParticipationDto;
  returnTo?: string;
}) {
  const router = useRouter();
  const { language, t, eventConfig, pageBase, eventRequest } = useEventText();
  const [registration, setRegistration] = useState(participation.registration);
  const [form, setForm] = useState<RegistrationInput>({
    displayName: "",
    role: "developer",
    country: "",
    organization: "",
    contact: "",
    acceptedTerms: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const disabled = !participation.canRegister;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setRegistration(
        await eventRequest<RegistrationDto>("/registration", "POST", form),
      );
      if (returnTo) router.push(returnTo);
    } catch (error) {
      setError(errorText(error, language));
    } finally {
      setBusy(false);
    }
  }
  return (
    <EventShell signedIn>
      <h1>{registration ? t.registerSuccess : t.register}</h1>
      <p className="ev-lead">
        {registration ? t.registrationReadonly : eventConfig.name[language]}
      </p>
      {registration ? (
        <section className="ev-panel">
          <dl>
            {[
              [t.name, registration.displayName],
              [t.email, registration.email],
              [t.role, roleLabels[language][registration.role]],
              [t.country, registration.country],
              [t.organization, registration.organization || "—"],
              [t.contact, registration.contact || "—"],
              [
                t.createdAt,
                dateText(
                  registration.createdAt,
                  language,
                  eventConfig.timeZone,
                ),
              ],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link className="button primary" href={pageBase + "/materials"}>
            {t.goMaterials} ↗
          </Link>
          {returnTo && (
            <Link className="button" href={returnTo}>
              {language === "zh" ? "继续组队" : "Continue to teams"} →
            </Link>
          )}
        </section>
      ) : (
        <form className="ev-panel ev-form" onSubmit={submit}>
          {disabled && (
            <p className="ev-notice">
              {participation.registrationReason === "NOT_OPEN"
                ? t.registrationNotOpen
                : t.registrationClosed}
            </p>
          )}
          <fieldset disabled={busy || disabled}>
            <label htmlFor="reg-email">
              {t.email}
              <input id="reg-email" value={email} readOnly type="email" />
            </label>
            <div className="ev-form-grid">
              <label htmlFor="reg-name">
                {t.name} *
                <input
                  id="reg-name"
                  required
                  maxLength={100}
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                />
              </label>
              <label htmlFor="reg-role">
                {t.role} *
                <select
                  id="reg-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as RegistrationRole,
                    })
                  }
                >
                  {Object.entries(roleLabels[language]).map(
                    ([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label htmlFor="reg-country">
                {t.country} *
                <input
                  id="reg-country"
                  required
                  maxLength={100}
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </label>
              <label htmlFor="reg-organization">
                {t.organization}
                <input
                  id="reg-organization"
                  maxLength={200}
                  value={form.organization}
                  onChange={(e) =>
                    setForm({ ...form, organization: e.target.value })
                  }
                />
              </label>
            </div>
            <label htmlFor="reg-contact">
              {t.contact}
              <input
                id="reg-contact"
                maxLength={200}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </label>
            <ul className="ev-rules">
              {eventConfig.rules[language].map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <label className="ev-check" htmlFor="reg-terms">
              <input
                id="reg-terms"
                type="checkbox"
                required
                checked={form.acceptedTerms}
                onChange={(e) =>
                  setForm({ ...form, acceptedTerms: e.target.checked })
                }
              />
              <span>{t.terms}</span>
            </label>
            <button className="button primary" type="submit">
              {busy ? t.saving : t.registerNow} ↗
            </button>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </EventShell>
  );
}
