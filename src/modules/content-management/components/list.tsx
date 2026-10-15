"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adminRequest, AdminApiError } from "../../admin/client";
import type { AdminIdentity } from "../../admin/contracts";
import {
  AdminShell,
  AccessDenied,
  useAdminText,
} from "../../admin/components/shared";
import type { ContentRecord } from "../contracts";
import type { EventDefinition } from "../../event-board/contracts";
import "../styles.css";
import { contentErrorText } from "./editor";
export function ContentEventList({ identity }: { identity: AdminIdentity }) {
  const { language } = useAdminText();
  const zh = language === "zh";
  const [items, setItems] = useState<ContentRecord<EventDefinition>[]>([]);
  const [id, setId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [locked, setLocked] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const d = await adminRequest<{ items: ContentRecord<EventDefinition>[] }>(
        "/content/events",
      );
      setItems(d.items);
      setError(null);
      setLocked(false);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    adminRequest<{ items: ContentRecord<EventDefinition>[] }>("/content/events")
      .then((d) => {
        if (active) setItems(d.items);
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (guard.current || locked) return;
    guard.current = true;
    setBusy(true);
    try {
      await adminRequest("/content/events", "POST", { id });
      setId("");
      await load();
    } catch (e) {
      setError(e);
      if (!(e instanceof AdminApiError) || e.status >= 500) setLocked(true);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  if (
    error instanceof AdminApiError &&
    (error.status === 401 || error.status === 403)
  )
    return <AccessDenied expired={error.status === 401} />;
  return (
    <AdminShell identity={identity}>
      <section className="adm-panel cm-editor">
        <h1>{zh ? "活动内容管理" : "Event content"}</h1>
        <p>
          {zh
            ? "新活动复制演示模板，创建后仅为草稿。"
            : "New events copy the demo template and remain drafts."}
        </p>
        <form onSubmit={create} className="adm-actions">
          <label>
            {zh
              ? "活动标识（小写字母、数字、连字符）"
              : "Event ID (lowercase letters, numbers, hyphens)"}
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={id}
              disabled={busy || locked}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <button disabled={busy || locked}>
            {zh ? "新建草稿" : "Create draft"}
          </button>
        </form>
        {!!error && (
          <p role="alert">
            {contentErrorText(error, language)}
            {error instanceof AdminApiError ? ` (${error.code})` : ""}
          </p>
        )}
        {locked && (
          <p>
            {zh
              ? "操作结果未知，请刷新列表核对标识后再操作。"
              : "Result unknown. Reload and check the ID before continuing."}
          </p>
        )}
        <button disabled={busy} onClick={load}>
          {zh ? "刷新列表" : "Reload list"}
        </button>
        {loading ? (
          <p role="status">{zh ? "加载中…" : "Loading…"}</p>
        ) : (
          <div className="cm-list">
            {items.map((item) => (
              <article key={item.id}>
                <h2>{item.draft.name[language]}</h2>
                <p>
                  {item.id} · {item.state} · r{item.revision}
                </p>
                <Link href={"/admin/events/" + encodeURIComponent(item.id)}>
                  {zh ? "编辑活动" : "Edit event"} →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
