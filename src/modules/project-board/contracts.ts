export type LocalizedText = { zh: string; en: string };
export type ProjectCategory =
  "software" | "hardware" | "game" | "aigc" | "other";
export interface ProjectFilters {
  q?: string;
  category?: string;
  event?: string;
  page?: string;
}
export interface ProjectCard {
  id: string;
  name: LocalizedText;
  introduction: LocalizedText;
  cover: string;
  category: ProjectCategory;
  tags: LocalizedText[];
  creator: LocalizedText;
  eventId: string | null;
  event: { id: string; name: LocalizedText; href: string } | null;
  publishedAt: string;
  demo: boolean;
}
export interface ProjectBoardDto {
  projects: ProjectCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: Required<ProjectFilters>;
  options: {
    categories: { id: ProjectCategory; name: LocalizedText }[];
    events: { id: string; name: LocalizedText }[];
  };
}
/** Future input contract only: no endpoint currently accepts this type.
 * Ownership, consent, upload and moderation must be specified by the submission module.
 * Never spread this input into a public ProjectCard.
 */
export interface FutureProjectSubmissionInput {
  name: string;
  tagline: string;
  description: string;
  category: ProjectCategory;
  eventId: string | null;
  tags: string[];
  coverAssetId: string | null;
  displayAssetIds: string[];
}
