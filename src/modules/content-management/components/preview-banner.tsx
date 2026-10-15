"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
export function PreviewBanner({ back }: { back: string }) {
  const { language } = useLanguage();
  return (
    <aside className="adm-preview-banner">
      <strong>
        {language === "zh"
          ? "管理员草稿预览 · 未发布"
          : "ADMIN DRAFT PREVIEW · NOT PUBLISHED"}
      </strong>{" "}
      <Link href={back}>
        {language === "zh" ? "返回编辑" : "Back to editor"} ↗
      </Link>
    </aside>
  );
}
