"use client";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";
import type {
  AssetDto,
  MaterialPayload,
  RegistrationDto,
} from "@/modules/event-participation/contracts";
import { reviewCopy } from "./copy";

export function useReviewText() {
  const { language } = useLanguage();
  return { language, t: reviewCopy[language] };
}
export function Registration({ value }: { value: RegistrationDto }) {
  const { t, language } = useReviewText();
  const roleNames = {
    developer: ["开发者", "Developer"],
    designer: ["设计师", "Designer"],
    product: ["产品", "Product"],
    student: ["学生", "Student"],
    other: ["其他", "Other"],
  };
  return (
    <section className="adm-panel">
      <h2>{t.registration}</h2>
      <dl className="adm-details">
        <dt>{t.participant}</dt>
        <dd>{value.displayName}</dd>
        <dt>{t.email}</dt>
        <dd>{value.email}</dd>
        <dt>{t.role}</dt>
        <dd>{roleNames[value.role][language === "zh" ? 0 : 1]}</dd>
        <dt>{t.country}</dt>
        <dd>{value.country || "—"}</dd>
        <dt>{t.organization}</dt>
        <dd>{value.organization || "—"}</dd>
        <dt>{t.contact}</dt>
        <dd>{value.contact || "—"}</dd>
      </dl>
    </section>
  );
}
function safeExternal(url: string) {
  try {
    const value = new URL(url);
    return value.protocol === "https:" || value.protocol === "http:"
      ? url
      : null;
  } catch {
    return null;
  }
}
export function OfficialMaterial({
  value,
  assets,
  submissionId,
  trackName,
}: {
  value: MaterialPayload;
  assets: AssetDto[];
  submissionId: string;
  trackName: string;
}) {
  const { t } = useReviewText();
  const url = (id: string) =>
    `/api/admin/materials/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(id)}`;
  const cover = assets.find((asset) => asset.id === value.coverId);
  const ids = [value.coverId, ...value.screenshotIds, value.documentId].filter(
    (id): id is string => Boolean(id),
  );
  const files = assets.filter((asset) => ids.includes(asset.id));
  return (
    <section className="adm-panel mr-official">
      <h2>{t.official}</h2>
      <p className="adm-muted">{t.private}</p>
      {cover && (
        <a href={url(cover.id)} target="_blank" rel="noopener noreferrer">
          <Image
            unoptimized
            src={url(cover.id)}
            width={1200}
            height={675}
            alt={t.cover}
            className="mr-cover"
          />
        </a>
      )}
      <h3>{value.name}</h3>
      <p className="mr-prewrap">{value.tagline}</p>
      <dl className="adm-details">
        <dt>{t.track}</dt>
        <dd>{trackName}</dd>
        <dt>{t.description}</dt>
        <dd>{value.description}</dd>
      </dl>
      {files.length ? (
        <ul className="mr-files">
          {files.map((asset) => (
            <li key={asset.id}>
              <span>
                {
                  t[
                    asset.purpose === "screenshot"
                      ? "screenshots"
                      : asset.purpose
                  ]
                }
              </span>
              <a href={url(asset.id)} target="_blank" rel="noopener noreferrer">
                {asset.originalName} ↗
              </a>
              <small>{Math.ceil(asset.size / 1024)} KB</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-muted">{t.noAssets}</p>
      )}
      <dl className="adm-details">
        {(
          [
            ["videoUrl", "video"],
            ["experienceUrl", "experience"],
            ["codeUrl", "code"],
          ] as const
        ).map(
          ([key, label]) =>
            value[key] && (
              <div className="mr-dl-row" key={key}>
                <dt>{t[label]}</dt>
                <dd>
                  {safeExternal(value[key]) ? (
                    <a
                      href={value[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {value[key]} ↗
                    </a>
                  ) : (
                    value[key]
                  )}
                </dd>
              </div>
            ),
        )}
      </dl>
      <h3>{t.declarations}</h3>
      <dl className="adm-details">
        {(
          [
            ["original", "original"],
            ["usageAuthorized", "authorized"],
            ["publicDisplay", "display"],
          ] as const
        ).map(([key, label]) => (
          <div className="mr-dl-row" key={key}>
            <dt>{t[label]}</dt>
            <dd>{value[key] ? t.yes : t.no}</dd>
          </div>
        ))}
      </dl>
      <p className="adm-muted">{t.noticePublic}</p>
    </section>
  );
}
