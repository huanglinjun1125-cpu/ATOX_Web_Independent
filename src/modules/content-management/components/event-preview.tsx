"use client";
import { useLanguage } from "@/components/language-provider";
import type { EventDefinition } from "../../event-board/contracts";
import { EventProvider } from "../../event-participation/components/shared";
import { ParticipantHub } from "../../participant-center/components/hub";
export function EventPreview({ event }: { event: EventDefinition }) {
  const { language } = useLanguage();
  return (
    <section className="adm-event-preview">
      <p>
        {language === "zh"
          ? "本页仅预览活动内容，报名与材料操作以已发布页面为准。"
          : "Content preview only. Registration and submissions use the published event."}
      </p>
      <EventProvider config={event}>
        <ParticipantHub
          preview
          signedIn
          participation={null}
          center={null}
          serverNow={new Date().toISOString()}
        />
      </EventProvider>
    </section>
  );
}
