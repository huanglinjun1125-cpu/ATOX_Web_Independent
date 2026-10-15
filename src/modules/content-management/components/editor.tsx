"use client";
import { useEffect, useRef, useState } from "react";
import { adminRequest, AdminApiError } from "../../admin/client";
import type { AdminIdentity } from "../../admin/contracts";
import {
  AdminShell,
  AdminDialog,
  AccessDenied,
  useAdminText,
  adminErrorText,
  dateText,
} from "../../admin/components/shared";
import {
  HOME_TEXT_KEYS,
  type ContentPayload,
  type ContentRecord,
  type HomepageContent,
} from "../contracts";
import type { EventDefinition, Localized } from "../../event-board/contracts";
import "../styles.css";
type History = {
  id: string;
  action: string;
  createdAt: string;
  actor?: { label: string };
  [key: string]: unknown;
};
export function contentErrorText(error: unknown, language: "zh" | "en") {
  const messages: Record<string, [string, string]> = {
    RECOMMENDATION_CONFLICT: [
      "已有推荐活动，请先取消其他活动推荐。",
      "Another event is recommended. Remove that recommendation first.",
    ],
    TRACK_IN_USE: [
      "赛道已有材料使用，不能删除或更改标识。",
      "A track is used by submissions; its ID cannot be removed or changed.",
    ],
    INVALID_DATES: [
      "请检查日期顺序、时区及带偏移的时间格式。",
      "Check date order, time zone and timestamps with offsets.",
    ],
    INVALID_CONTENT: [
      "内容不符合要求，请检查必填双语字段和链接。",
      "Check required bilingual fields and links.",
    ],
    INVALID_ID: [
      "活动标识格式无效，请使用小写字母、数字及连字符。",
      "Use lowercase letters, numbers and hyphens for the event ID.",
    ],
    ID_EXISTS: [
      "活动标识已存在，请选择其他标识。",
      "This event ID already exists. Choose another.",
    ],
    SAVE_BEFORE_PUBLISH: [
      "请先保存草稿，再发布。",
      "Save the draft before publishing.",
    ],
    NOT_PUBLISHED: [
      "当前内容未发布，不能下架。",
      "This content is not published and cannot be withdrawn.",
    ],
  };
  return error instanceof AdminApiError && messages[error.code]
    ? messages[error.code][language === "zh" ? 0 : 1]
    : adminErrorText(error, language);
}
type Response = { content: ContentRecord; history: History[] };
const homeLabels: Record<string, [string, string]> = {
  heroEyebrow: ["首屏眉题", "Hero eyebrow"],
  heroLineOne: ["首屏第一行", "Hero line one"],
  heroLineTwo: ["首屏第二行", "Hero line two"],
  heroAccent: ["首屏强调语", "Hero accent"],
  heroDescription: ["首屏介绍", "Hero description"],
  heroNote: ["首屏备注", "Hero note"],
  aboutTitle: ["组织标题", "About title"],
  aboutLead: ["组织引言", "About lead"],
  aboutBody: ["组织正文", "About body"],
  aboutClosing: ["组织结语", "About closing"],
  programsTitle: ["主办方向标题", "Programs title"],
  programsIntro: ["主办方向介绍", "Programs introduction"],
  exploreTitle: ["探索标题", "Explore title"],
  eventCardTitle: ["活动入口标题", "Event link title"],
  eventCardBody: ["活动入口介绍", "Event link description"],
  projectCardTitle: ["项目入口标题", "Project link title"],
  projectCardBody: ["项目入口介绍", "Project link description"],
  footerTagline: ["页脚标语", "Footer tagline"],
};
export function ContentEditor({
  identity,
  eventId,
}: {
  identity: AdminIdentity;
  eventId?: string;
}) {
  const { language } = useAdminText();
  const zh = language === "zh";
  const path = eventId
    ? "/content/events/" + encodeURIComponent(eventId)
    : "/content/homepage";
  const [data, setData] = useState<Response | null>(null);
  const [draft, setDraft] = useState<ContentPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<
    "publish" | "withdraw" | "reload" | null
  >(null);
  const dirty =
    !!data &&
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(data.content.draft);
  useEffect(() => {
    let active = true;

    adminRequest<Response>(path)
      .then((d) => {
        if (active) {
          setData(d);
          setDraft(d.content.draft);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [path]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        a.target === "_blank" ||
        a.origin !== location.origin ||
        a.href === location.href
      )
        return;
      if (
        !window.confirm(
          zh
            ? "存在未保存修改，确定离开？"
            : "Discard unsaved changes and leave?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, zh]);
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      const d = await adminRequest<Response>(path);
      setData(d);
      setDraft(d.content.draft);
      setLocked(false);
      setError(null);
      setNotice(
        zh
          ? "已重新读取，请核对当前版本。"
          : "Reloaded. Check the current version.",
      );
      setConfirm(null);
    } catch (e) {
      setError(e);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function mutate(action: "save" | "publish" | "withdraw") {
    if (!data || !draft || guard.current || locked) return;
    guard.current = true;
    setBusy(true);
    setNotice("");
    try {
      const d = await adminRequest<Response>(
        path,
        action === "save" ? "PUT" : "POST",
        {
          revision: data.content.revision,
          action,
          ...(action === "save" ? { draft } : {}),
        },
      );
      setData(d);
      setDraft(d.content.draft);
      setError(null);
      setNotice(
        zh ? "操作成功，已保存当前版本。" : "Success. Current version saved.",
      );
      setConfirm(null);
    } catch (e) {
      setError(e);
      if (
        !(e instanceof AdminApiError) ||
        e.status === 409 ||
        e.status >= 500
      ) {
        setLocked(true);
        setConfirm(null);
        setNotice(
          zh
            ? "版本冲突或结果未知，输入已保留。请重新读取核对后再操作。"
            : "Conflict or unknown result. Input retained. Reload and check before continuing.",
        );
      }
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  function pair(
    label: string,
    value: Localized,
    change: (v: Localized) => void,
  ) {
    return (
      <fieldset className="cm-pair">
        <legend>{label}</legend>
        {(["zh", "en"] as const).map((lang) => (
          <label key={lang}>
            {lang === "zh" ? "中文" : "English"}
            <textarea
              value={value[lang]}
              onChange={(e) => change({ ...value, [lang]: e.target.value })}
            />
          </label>
        ))}
      </fieldset>
    );
  }
  function setEvent(key: keyof EventDefinition, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }) as EventDefinition);
  }
  if (
    error instanceof AdminApiError &&
    (error.status === 401 || error.status === 403)
  )
    return <AccessDenied expired={error.status === 401} />;
  const event = eventId ? (draft as EventDefinition | null) : null;
  const home = !eventId ? (draft as HomepageContent | null) : null;
  return (
    <AdminShell identity={identity}>
      <section className="adm-panel cm-editor">
        <h1>
          {eventId
            ? zh
              ? "编辑活动"
              : "Edit event"
            : zh
              ? "官网内容管理"
              : "Homepage content"}
        </h1>
        {!!error && (
          <p role="alert">
            {contentErrorText(error, language)}
            {error instanceof AdminApiError ? ` (${error.code})` : ""}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!data || !draft ? (
          <>
            <p>{zh ? "等待加载内容" : "Waiting for content"}</p>
            <button onClick={reload}>{zh ? "重新读取" : "Reload"}</button>
          </>
        ) : (
          <>
            <p>
              {data.content.id} ·{" "}
              {
                {
                  draft: zh ? "草稿" : "Draft",
                  published: zh ? "已发布" : "Published",
                  withdrawn: zh ? "已下架" : "Withdrawn",
                }[data.content.state]
              }{" "}
              · r{data.content.revision}
            </p>
            <p>
              {zh ? "变更人／时间" : "Changed by / at"}:{" "}
              {data.history.find(row => (row.after as {revision?:number}|null)?.revision === data.content.revision)?.actor?.label ?? "—"} · {data.content.updatedBy ? dateText(data.content.updatedAt, language) : (zh ? "原始配置" : "Baseline configuration")}
            </p>
            <p>
              {zh ? "线上版本" : "Live version"}:{" "}
              {data.content.live
                ? eventId
                  ? (data.content.live as EventDefinition).name[language]
                  : (data.content.live as HomepageContent).metadata.title[
                      language
                    ]
                : zh
                  ? "无发布内容"
                  : "No published content"}{" "}
              · {data.content.publishedAt ? dateText(data.content.publishedAt, language) : "—"}
            </p>
            <p>
              {eventId
                ? zh
                  ? "下架后全部公众入口返回404，管理员仍可审阅。"
                  : "Withdrawal makes public entries return 404; administrators retain access."
                : zh
                  ? "下架后官网回退默认演示首页。"
                  : "Withdrawal restores the default demo homepage."}
            </p>
            <fieldset disabled={busy || locked} className="cm-fields">
              {event && (
                <>
                  <p>
                    {zh ? "活动标识只读" : "Event ID is immutable"}: {event.id}
                  </p>
                  {(
                    [
                      "name",
                      "theme",
                      "introduction",
                      "organizer",
                      "location",
                    ] as const
                  ).map((key, i) => (
                    <div key={key}>
                      {pair(
                        (zh
                          ? [
                              "活动名称",
                              "活动主题",
                              "活动介绍",
                              "主办方",
                              "地点",
                            ]
                          : [
                              "Name",
                              "Theme",
                              "Introduction",
                              "Organizer",
                              "Location",
                            ])[i],
                        event[key],
                        (v) => setEvent(key, v),
                      )}
                    </div>
                  ))}
                  <label>
                    {zh ? "时区" : "Time zone"}
                    <input
                      value={event.timeZone}
                      onChange={(e) => setEvent("timeZone", e.target.value)}
                    />
                  </label>
                  <p>
                    {zh
                      ? "时间使用带时区偏移的ISO格式，如2027-01-15T09:00:00+08:00；不按电脑本地时区转换。"
                      : "Use ISO timestamps with an offset, e.g. 2027-01-15T09:00:00+08:00. No local-time conversion."}
                  </p>
                  {(
                    [
                      "startsAt",
                      "endsAt",
                      "registrationOpensAt",
                      "registrationClosesAt",
                      "submissionOpensAt",
                      "submissionClosesAt",
                    ] as const
                  ).map((key, i) => (
                    <label key={key}>
                      {
                        (zh
                          ? [
                              "活动开始",
                              "活动结束",
                              "报名开放",
                              "报名截止",
                              "提交开放",
                              "提交截止",
                            ]
                          : [
                              "Event starts",
                              "Event ends",
                              "Registration opens",
                              "Registration closes",
                              "Submission opens",
                              "Submission closes",
                            ])[i]
                      }
                      <input
                        value={event[key]}
                        onChange={(e) => setEvent(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <label>
                    {zh ? "封面" : "Cover"}
                    <select
                      value={event.cover}
                      onChange={(e) => setEvent("cover", e.target.value)}
                    >
                      {[
                        ...new Set([
                          event.cover,
                          "/event-covers/demo.svg",
                          "/event-covers/upcoming-demo.svg",
                          "/event-covers/past-demo.svg",
                        ]),
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["recommended", "demo"] as const).map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={event[key]}
                        onChange={(e) => setEvent(key, e.target.checked)}
                      />
                      {key === "demo"
                        ? zh
                          ? "演示活动"
                          : "Demo event"
                        : zh
                          ? "推荐活动"
                          : "Recommended"}
                    </label>
                  ))}
                  <h2>{zh ? "赛道" : "Tracks"}</h2>
                  {event.tracks.map((track, i) => (
                    <div key={i} className="cm-track">
                      <label>
                        {zh ? "赛道标识" : "Track ID"}
                        <input
                          value={track.id}
                          onChange={(e) =>
                            setEvent(
                              "tracks",
                              event.tracks.map((t, j) =>
                                j === i ? { ...t, id: e.target.value } : t,
                              ),
                            )
                          }
                        />
                      </label>
                      {pair(zh ? "赛道名称" : "Track name", track.name, (v) =>
                        setEvent(
                          "tracks",
                          event.tracks.map((t, j) =>
                            j === i ? { ...t, name: v } : t,
                          ),
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEvent(
                            "tracks",
                            event.tracks.filter((_, j) => j !== i),
                          )
                        }
                      >
                        {zh ? "删除赛道" : "Remove track"}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setEvent("tracks", [
                        ...event.tracks,
                        { id: "", name: { zh: "", en: "" } },
                      ])
                    }
                  >
                    {zh ? "新增赛道" : "Add track"}
                  </button>
                  {pair(
                    zh ? "规则（每行一项）" : "Rules (one per line)",
                    {
                      zh: event.rules.zh.join("\n"),
                      en: event.rules.en.join("\n"),
                    },
                    (v) =>
                      setEvent("rules", {
                        zh: v.zh.split("\n"),
                        en: v.en.split("\n"),
                      }),
                  )}
                </>
              )}
              {home && (
                <>
                  {HOME_TEXT_KEYS.map((key) => (
                    <div key={key}>
                      {pair(homeLabels[key][zh ? 0 : 1], home.text[key], (v) =>
                        setDraft({ ...home, text: { ...home.text, [key]: v } }),
                      )}
                    </div>
                  ))}
                  <h2>{zh ? "主办方向（3项）" : "Programs (3 items)"}</h2>
                  {home.programs.map((p, i) => (
                    <div key={i}>
                      {(["title", "subtitle", "body"] as const).map(
                        (key, j) => (
                          <div key={key}>
                            {pair(
                              `${i + 1} · ${(zh ? ["标题", "副标题", "介绍"] : ["Title", "Subtitle", "Description"])[j]}`,
                              p[key],
                              (v) =>
                                setDraft({
                                  ...home,
                                  programs: home.programs.map((x, n) =>
                                    n === i ? { ...x, [key]: v } : x,
                                  ),
                                }),
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  ))}
                  {(["title", "description"] as const).map((key) => (
                    <div key={key}>
                      {pair(
                        key === "title"
                          ? zh
                            ? "页面标题"
                            : "Page title"
                          : zh
                            ? "页面描述"
                            : "Page description",
                        home.metadata[key],
                        (v) =>
                          setDraft({
                            ...home,
                            metadata: { ...home.metadata, [key]: v },
                          }),
                      )}
                    </div>
                  ))}
                </>
              )}
            </fieldset>
            <div className="adm-actions">
              <button
                disabled={busy || locked || !dirty}
                onClick={() => mutate("save")}
              >
                {zh ? "保存草稿" : "Save draft"}
              </button>
              <button disabled={busy} onClick={() => setConfirm("reload")}>
                {zh ? "重新读取" : "Reload"}
              </button>
              {!dirty && !locked && data.content.revision > 0 ? (
                <a
                  href={
                    eventId
                      ? `/admin/events/${encodeURIComponent(eventId)}/preview`
                      : "/admin/content/homepage/preview"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {zh ? "预览已保存草稿" : "Preview saved draft"}
                </a>
              ) : (
                <span>
                  {zh
                    ? "先保存草稿再预览或发布"
                    : "Save before preview or publish"}
                </span>
              )}
              <button
                disabled={
                  busy || locked || dirty || data.content.revision === 0
                }
                onClick={() => setConfirm("publish")}
              >
                {zh ? "发布" : "Publish"}
              </button>
              <button
                disabled={
                  busy || locked || dirty || data.content.state !== "published"
                }
                onClick={() => setConfirm("withdraw")}
              >
                {zh ? "下架" : "Withdraw"}
              </button>
            </div>
            <h2>{zh ? "操作历史（只读）" : "History (read only)"}</h2>
            <ul>
              {data.history.map((h) => (
                <li key={h.id}>
                  {h.action} · {h.actor?.label ?? "—"} · {h.createdAt}
                  <details>
                    <summary>
                      {zh ? "查看变更前后内容" : "Inspect before and after"}
                    </summary>
                    <pre>
                      {JSON.stringify(
                        { before: h.before, after: h.after },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
        {confirm && (
          <AdminDialog
            title={
              confirm === "reload"
                ? zh
                  ? "放弃输入并重新读取？"
                  : "Discard input and reload?"
                : confirm === "publish"
                  ? zh
                    ? "确认发布已保存草稿？"
                    : "Publish saved draft?"
                  : zh
                    ? "确认下架？"
                    : "Withdraw content?"
            }
            close={() => setConfirm(null)}
            busy={busy}
          >
            <p>
              {confirm === "reload"
                ? zh
                  ? "未保存输入将被替换，请核对最新版本。"
                  : "Unsaved input will be replaced. Check the latest version."
                : zh
                  ? "操作将影响公开页面。"
                  : "This changes the public page."}
            </p>
            <button
              disabled={busy}
              onClick={() =>
                confirm === "reload" ? reload() : mutate(confirm)
              }
            >
              {zh ? "确认" : "Confirm"}
            </button>
          </AdminDialog>
        )}
      </section>
    </AdminShell>
  );
}
