import type { EventDefinition, Localized } from "../event-board/contracts";
export type ContentKind = "event" | "homepage";
export type PublicationState = "draft" | "published" | "withdrawn";
export const HOME_TEXT_KEYS = [
  "heroEyebrow",
  "heroLineOne",
  "heroLineTwo",
  "heroAccent",
  "heroDescription",
  "heroNote",
  "aboutTitle",
  "aboutLead",
  "aboutBody",
  "aboutClosing",
  "programsTitle",
  "programsIntro",
  "exploreTitle",
  "eventCardTitle",
  "eventCardBody",
  "projectCardTitle",
  "projectCardBody",
  "footerTagline",
] as const;
export type HomeTextKey = (typeof HOME_TEXT_KEYS)[number];
export interface HomepageContent {
  text: Record<HomeTextKey, Localized>;
  programs: { title: Localized; subtitle: Localized; body: Localized }[];
  metadata: { title: Localized; description: Localized };
}
export type ContentPayload = EventDefinition | HomepageContent;
export interface ContentRecord<T = ContentPayload> {
  id: string;
  kind: ContentKind;
  revision: number;
  state: PublicationState;
  draft: T;
  live: T | null;
  updatedAt: string;
  publishedAt: string | null;
  updatedBy: string | null;
}
export interface ContentCommand {
  revision: number;
  action: "save" | "publish" | "withdraw";
  draft?: ContentPayload;
}
