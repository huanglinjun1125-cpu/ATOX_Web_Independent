import type {
  RegistrationDto,
  MaterialPayload,
  AssetDto,
} from "../event-participation/contracts";
import type { AdminActor } from "../admin/contracts";
export type ReviewStatus = "pending" | "approved" | "rejected";
export interface MaterialReviewItem {
  id: string;
  eventId: string;
  eventName: { zh: string; en: string };
  projectName: string;
  registration: RegistrationDto;
  status: ReviewStatus;
  revision: number;
  submittedRevision: number;
  submittedAt: string | null;
  processedAt: string | null;
  reason: string | null;
}
export interface MaterialReviewSnapshot {
  revision: number;
  submittedRevision: number;
  status: ReviewStatus;
  reason: string | null;
  internalNote: string | null;
}
export interface MaterialReviewHistory extends MaterialReviewSnapshot {
  id: string;
  action: string;
  actor: AdminActor;
  before: MaterialReviewSnapshot | null;
  after: MaterialReviewSnapshot;
  createdAt: string;
}
export interface MaterialReviewDetail extends MaterialReviewItem {
  official: MaterialPayload;
  internalNote: string | null;
  assets: AssetDto[];
  history: MaterialReviewHistory[];
}
export interface ReviewFilters {
  page?: number;
  eventId?: string;
  status?: ReviewStatus;
}
export interface DecisionInput {
  revision: number;
  submittedRevision: number;
  action: "approved" | "rejected";
  reason: string;
  internalNote?: string;
}
