import type { BaseDocument } from "./common.types.js";
import type { IntentLevel } from "./chat.types.js";

export type LeadStatus =
  | "NEW"
  | "QUALIFIED"
  | "DEMO_REQUESTED"
  | "SYNCED"
  | "LOST";

export interface Lead extends BaseDocument {
  sessionId: string;
  websiteId: string;
  name: string;
  email: string;
  company?: string;
  jobTitle?: string;
  useCase?: string;
  currentSolution?: string;
  intentLevel: IntentLevel;
  status: LeadStatus;
  marketoLeadId?: number;
  marketoSyncedAt?: Date;
}

export type PartialLead = Partial<
  Pick<
    Lead,
    "name" | "email" | "company" | "jobTitle" | "useCase" | "currentSolution"
  >
>;

export type CreateLeadInput = Omit<
  Lead,
  keyof BaseDocument | "marketoLeadId" | "marketoSyncedAt"
>;

export type UpdateLeadInput = Partial<
  Pick<
    Lead,
    | "company"
    | "jobTitle"
    | "useCase"
    | "currentSolution"
    | "intentLevel"
    | "status"
  >
>;
