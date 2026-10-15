import type { RegistrationRole } from "../event-participation/contracts";
export type ApplicationState =
  "pending" | "accepted" | "rejected" | "withdrawn" | "expired";
export type TeamStage =
  "recruiting" | "paused" | "full" | "closed" | "dissolved";
export interface TeamInput {
  name: string;
  description: string;
  trackId: string;
  skills: string;
  recruitment: string;
  capacity: number;
}
export interface TeamCard extends TeamInput {
  id: string;
  captainName: string;
  count: number;
  vacancies: number;
  stage: TeamStage;
  recruiting: boolean;
  revision: number;
  createdAt: string;
}
export interface MemberDto {
  userId: string;
  displayName: string;
  role: RegistrationRole;
  captain: boolean;
}
export interface ApplicationDto {
  id: string;
  teamId: string;
  teamName: string;
  applicantId: string;
  displayName: string;
  role: RegistrationRole;
  skills: string;
  message: string;
  status: ApplicationState;
  reason: string | null;
  stillMember: boolean;
  createdAt: string;
}
export interface CenterDto {
  team: (TeamCard & { members: MemberDto[] }) | null;
  applications: ApplicationDto[];
  incoming: ApplicationDto[];
  registered: boolean;
  canManage: boolean;
  isCaptain: boolean;
  opensAt: string;
  closesAt: string;
  minSize: number;
  maxSize: number;
  serverNow: string;
}
export type TeamCommand =
  | { action: "create"; input: TeamInput }
  | {
      action: "edit";
      teamId: string;
      revision: number;
      input: TeamInput;
      recruiting: boolean;
    }
  | { action: "apply"; teamId: string; skills: string; message: string }
  | { action: "withdraw"; applicationId: string }
  | {
      action: "approve" | "reject";
      applicationId: string;
      teamId: string;
      revision: number;
    }
  | { action: "leave" | "dissolve"; teamId: string; revision: number }
  | {
      action: "remove" | "transfer";
      teamId: string;
      revision: number;
      userId: string;
    };
