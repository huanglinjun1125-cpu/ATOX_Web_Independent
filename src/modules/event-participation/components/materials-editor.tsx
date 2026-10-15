"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyMaterial } from "../contracts";
import type {
  AssetDto,
  AssetPurpose,
  MaterialPayload,
  MaterialsDto,
  ParticipationDto,
} from "../contracts";
import { EventApiError } from "../client";
import {
  AssetLinks,
  dateText,
  errorText,
  EventShell,
  MaterialPreview,
  Status,
  useEventText,
} from "./shared";
export function MaterialsEditor({
  initial,
  participation,
}: {
  initial: MaterialsDto;
  participation: ParticipationDto;
}) {
  const { language, t, eventConfig, pageBase, eventRequest } = useEventText();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [form, setForm] = useState<MaterialPayload>(
    initial.draft ?? initial.official ?? emptyMaterial(eventConfig),
  );
  const [assets, setAssets] = useState(initial.assets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const editable = data.canEdit && !conflict;
  const dirty =
    JSON.stringify(form) !==
    JSON.stringify(data.draft ?? data.official ?? emptyMaterial(eventConfig));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function fail(error: unknown) {
    if (error instanceof EventApiError && error.code === "REVISION_CONFLICT") {
      setConflict(true);
      setError(t.conflict);
    } else setError(errorText(error, language));
  }
  async function saveDraft() {
    const updated = await eventRequest<MaterialsDto>(
      "/materials/draft",
      "PUT",
      { revision: data.revision, payload: form },
    );
    setData(updated);
    setAssets(updated.assets);
    setForm(updated.draft ?? updated.official ?? emptyMaterial(eventConfig));
    return updated;
  }
  async function persist(submit: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        submit &&
        (!form.name.trim() ||
          !form.tagline.trim() ||
          !form.description.trim() ||
          !form.coverId ||
          !form.documentId ||
          !form.original ||
          !form.usageAuthorized)
      ) {
        setError(t.required);
        return;
      }
      const updated = await saveDraft();
      if (submit) {
        const official = await eventRequest<MaterialsDto>(
          "/materials/submit",
          "POST",
          { revision: updated.revision },
        );
        setData(official);
        setAssets(official.assets);
        setForm(
          official.draft ?? official.official ?? emptyMaterial(eventConfig),
        );
        setNotice(t.submitted);
      } else setNotice(t.saved);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined, purpose: AssetPurpose) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const max =
        purpose === "document"
          ? eventConfig.fileRules.documentMaxBytes
          : eventConfig.fileRules.imageMaxBytes;
      if (file.size > max) throw new EventApiError("FILE_TOO_LARGE", 400);
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", purpose);
      const asset = await eventRequest<AssetDto>("/files", "POST", body);
      setAssets((previous) => [...previous, asset]);
      setForm((previous) =>
        purpose === "cover"
          ? { ...previous, coverId: asset.id }
          : purpose === "document"
            ? { ...previous, documentId: asset.id }
            : {
                ...previous,
                screenshotIds: [...previous.screenshotIds, asset.id].slice(
                  0,
                  eventConfig.fileRules.maxScreenshots,
                ),
              },
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    if (!window.confirm(t.confirmReload)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await eventRequest<MaterialsDto>("/materials");
      setData(updated);
      setAssets(updated.assets);
      setForm(updated.draft ?? updated.official ?? emptyMaterial(eventConfig));
      setConflict(false);
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  const remove = (purpose: AssetPurpose, id: string) =>
    setForm((previous) =>
      purpose === "cover"
        ? { ...previous, coverId: null }
        : purpose === "document"
          ? { ...previous, documentId: null }
          : {
              ...previous,
              screenshotIds: previous.screenshotIds.filter(
                (value) => value !== id,
              ),
            },
    );
  return (
    <EventShell
      signedIn
      onNavigate={() => !dirty || window.confirm(t.confirmLeave)}
    >
      <h1>{t.materials}</h1>
      {!participation.registration ? (
        <section className="ev-panel">
          <p>{t.notRegistered}</p>
          <Link className="button primary" href={pageBase + "/register"}>
            {t.goRegister} ↗
          </Link>
        </section>
      ) : (
        <>
          <Status data={data} />
          {dirty && (
            <p className="ev-notice" role="status">
              {t.unsavedDraft}
            </p>
          )}
          {data.publicNote && (
            <section className="ev-feedback">
              <h2>{t.feedback}</h2>
              <p className="ev-prewrap">{data.publicNote}</p>
            </section>
          )}
          {!data.canEdit && (
            <p className="ev-notice">
              {t.readonly} · {data.reason ? t[data.reason] : ""}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="ev-success" role="status">
              {notice}
            </p>
          )}
          {conflict && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void reload()}
            >
              {t.reload}
            </button>
          )}
          {data.canEdit ? (
            <form
              className="ev-panel ev-form"
              onSubmit={(e) => {
                e.preventDefault();
                void persist(true);
              }}
            >
              <h2>{t.draft}</h2>
              <p className="ev-help">{t.required}</p>
              <fieldset disabled={!editable || busy}>
                <div className="ev-form-grid">
                  <label htmlFor="material-name">
                    {t.projectName} *
                    <input
                      id="material-name"
                      value={form.name}
                      maxLength={120}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label htmlFor="material-track">
                    {t.track} *
                    <select
                      id="material-track"
                      value={form.trackId}
                      onChange={(e) =>
                        setForm({ ...form, trackId: e.target.value })
                      }
                    >
                      {eventConfig.tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.name[language]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label htmlFor="material-tagline">
                  {t.tagline} *
                  <input
                    id="material-tagline"
                    maxLength={240}
                    value={form.tagline}
                    onChange={(e) =>
                      setForm({ ...form, tagline: e.target.value })
                    }
                  />
                </label>
                <label htmlFor="material-description">
                  {t.description} *
                  <textarea
                    id="material-description"
                    rows={7}
                    maxLength={10000}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <p className="ev-help">{t.fileHint}</p>
                <div className="ev-upload-grid">
                  {(
                    [
                      ["cover", t.cover, [form.coverId]],
                      ["screenshot", t.screenshots, form.screenshotIds],
                      ["document", t.document, [form.documentId]],
                    ] as [AssetPurpose, string, (string | null)[]][]
                  ).map(([purpose, label, ids]) => (
                    <section className="ev-upload" key={purpose}>
                      <h3>
                        {label}
                        {purpose !== "screenshot" ? " *" : ""}
                      </h3>
                      <AssetLinks ids={ids} assets={assets} />
                      {ids.filter(Boolean).map((id) => (
                        <button
                          type="button"
                          className="ev-remove"
                          key={id}
                          onClick={() => remove(purpose, id!)}
                        >
                          {t.remove}:{" "}
                          {assets.find((a) => a.id === id)?.originalName ?? id}
                        </button>
                      ))}
                      <label
                        className="ev-file-button"
                        htmlFor={`file-${purpose}`}
                      >
                        {busy ? t.busyUpload : t.upload}
                        <input
                          id={`file-${purpose}`}
                          type="file"
                          aria-label={label}
                          accept={
                            purpose === "document"
                              ? "application/pdf"
                              : "image/png,image/jpeg,image/webp"
                          }
                          disabled={
                            busy ||
                            !editable ||
                            (purpose === "screenshot" &&
                              form.screenshotIds.length >=
                                eventConfig.fileRules.maxScreenshots)
                          }
                          onChange={(e) => {
                            void upload(e.target.files?.[0], purpose);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </section>
                  ))}
                </div>
                {(
                  [
                    ["videoUrl", t.video],
                    ["experienceUrl", t.experience],
                    ["codeUrl", t.code],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} htmlFor={`material-${key}`}>
                    {label}
                    <input
                      id={`material-${key}`}
                      type="url"
                      placeholder="https://"
                      value={form[key]}
                      maxLength={2000}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {(
                  [
                    ["original", t.original],
                    ["usageAuthorized", t.usage],
                    ["publicDisplay", t.publicDisplay],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    className="ev-check"
                    key={key}
                    htmlFor={`material-${key}`}
                  >
                    <input
                      id={`material-${key}`}
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.checked })
                      }
                    />
                    <span>
                      {label}
                      {key !== "publicDisplay" ? " *" : ""}
                    </span>
                  </label>
                ))}
                <div className="ev-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void persist(false)}
                  >
                    {busy ? t.saving : t.save}
                  </button>
                  <button className="button primary" type="submit">
                    {busy ? t.saving : t.submit} ↗
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            data.draft && (
              <section className="ev-panel">
                <h2>{t.draftPreview}</h2>
                <p className="ev-help">{t.readOnlyHint}</p>
                <MaterialPreview payload={data.draft} assets={assets} />
              </section>
            )
          )}
          <section className="ev-panel ev-official">
            <div className="ev-section-title">
              <h2>{t.official}</h2>
              <span className="ev-badge">{t[data.status]}</span>
            </div>
            {data.official ? (
              <>
                <p className="ev-help">
                  {t.submittedRevision}: {data.submittedRevision}
                  {data.submittedAt && (
                    <>
                      {" "}
                      · {t.submissionDate}:{" "}
                      {dateText(
                        data.submittedAt,
                        language,
                        eventConfig.timeZone,
                      )}
                    </>
                  )}
                  {data.processedAt && (
                    <>
                      {" "}
                      · {t.reviewDate}:{" "}
                      {dateText(
                        data.processedAt,
                        language,
                        eventConfig.timeZone,
                      )}
                    </>
                  )}
                </p>
                <MaterialPreview payload={data.official} assets={assets} />
              </>
            ) : (
              <p className="ev-help">{t.noOfficial}</p>
            )}
          </section>
        </>
      )}
    </EventShell>
  );
}
