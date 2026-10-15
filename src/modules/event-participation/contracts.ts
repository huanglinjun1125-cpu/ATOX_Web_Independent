import { eventConfig } from "./config";

export type EventLanguage = "zh" | "en";
export type RegistrationRole =
  "developer" | "designer" | "product" | "student" | "other";
export type MaterialStatus =
  "not_submitted" | "pending" | "needs_changes" | "processed";
export type ReviewResult = "accepted" | "rejected";
export type AssetPurpose = "cover" | "screenshot" | "document";
export type BlockReason =
  "NOT_REGISTERED" | "NOT_OPEN" | "CLOSED" | "PROCESSED" | null;
export interface RegistrationInput {
  displayName: string;
  role: RegistrationRole;
  country: string;
  organization: string;
  contact: string;
  acceptedTerms: boolean;
}
export interface RegistrationDto extends RegistrationInput {
  id: string;
  email: string;
  createdAt: string;
}
export interface MaterialPayload {
  name: string;
  tagline: string;
  description: string;
  trackId: string;
  coverId: string | null;
  screenshotIds: string[];
  documentId: string | null;
  videoUrl: string;
  experienceUrl: string;
  codeUrl: string;
  original: boolean;
  usageAuthorized: boolean;
  publicDisplay: boolean;
}
export interface AssetDto {
  id: string;
  purpose: AssetPurpose;
  originalName: string;
  mediaType: string;
  size: number;
  url: string;
}
export interface ParticipationDto {
  reviewStatus?: "pending" | "approved" | "rejected" | null;
  registration: RegistrationDto | null;
  status: MaterialStatus;
  hasDraft: boolean;
  canRegister: boolean;
  registrationReason: "NOT_OPEN" | "CLOSED" | null;
  canEdit: boolean;
  reason: BlockReason;
  serverNow: string;
}
export interface MaterialsDto {
  id: string | null;
  official: MaterialPayload | null;
  draft: MaterialPayload | null;
  revision: number;
  submittedRevision: number;
  status: MaterialStatus;
  result: ReviewResult | null;
  publicNote: string | null;
  submittedAt: string | null;
  processedAt: string | null;
  assets: AssetDto[];
  canEdit: boolean;
  reason: BlockReason;
}
export interface DraftInput {
  revision: number;
  payload: MaterialPayload;
}
export interface SubmitInput {
  revision: number;
}
export interface ReviewInput {
  revision: number;
  submittedRevision: number;
  action: "needs_changes" | ReviewResult;
  publicNote: string;
  internalNote?: string;
}
export interface ReviewItem extends Omit<
  MaterialsDto,
  "draft" | "canEdit" | "reason"
> {
  registration: RegistrationDto;
  internalNote: string | null;
}
export const EVENT_API = "/api/events/demo";
export const eventApi = (eventId: string) =>
  `/api/events/${encodeURIComponent(eventId)}`;
export const emptyMaterial = (config = eventConfig): MaterialPayload => ({
  name: "",
  tagline: "",
  description: "",
  trackId: config.tracks[0]?.id ?? "",
  coverId: null,
  screenshotIds: [],
  documentId: null,
  videoUrl: "",
  experienceUrl: "",
  codeUrl: "",
  original: false,
  usageAuthorized: false,
  publicDisplay: false,
});
