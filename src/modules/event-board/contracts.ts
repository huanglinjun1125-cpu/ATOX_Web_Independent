export type Localized = { zh: string; en: string };
export type EventStage = "upcoming" | "ongoing" | "ended";
export type RegistrationState = "not_open" | "open" | "closed";
export interface EventDefinition {
  participantCenter?: {
    minSize?: number;
    maxSize?: number;
    opensAt?: string;
    closesAt?: string;
    resources?: { title: Localized; url: string }[];
    faq?: { question: Localized; answer: Localized }[];
    communityUrl?: string;
  };
  id: string;
  published: boolean;
  demo: boolean;
  recommended: boolean;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  submissionOpensAt: string;
  submissionClosesAt: string;
  name: Localized;
  theme: Localized;
  introduction: Localized;
  organizer: Localized;
  location: Localized;
  cover: string;
  target: string | null;
  tags: Localized[];
  tracks: { id: string; name: Localized }[];
  rules: { zh: string[]; en: string[] };
  fileRules: {
    imageMaxBytes: number;
    documentMaxBytes: number;
    maxScreenshots: number;
  };
}
export interface BoardCardDto extends Pick<
  EventDefinition,
  | "id"
  | "name"
  | "theme"
  | "introduction"
  | "cover"
  | "organizer"
  | "location"
  | "startsAt"
  | "endsAt"
  | "timeZone"
  | "target"
  | "recommended"
  | "demo"
  | "tags"
> {
  year: number;
  stage: EventStage;
}
export interface BoardDto {
  events: BoardCardDto[];
  serverNow: string;
}
export interface BoardFilters {
  q?: string;
  year?: string;
  stage?: string;
}
