import type { Session } from "./chat.types.js";
import type { Lead, PartialLead } from "./lead.types.js";
import type { Tenant } from "./tenant.types.js";

export interface CreateSessionRequest {
  websiteId: string;
  metadata: {
    userAgent: string;
    referrer?: string;
    pageUrl: string;
  };
}

export interface CreateSessionResponse {
  sessionToken: string;
  welcomeMessage: string;
  branding: Tenant["branding"];
}

export interface SendMessageRequest {
  content: string;
  sessionToken: string;
  websiteId: string;
}

export interface CaptureLeadRequest {
  sessionToken: string;
  websiteId: string;
  lead: PartialLead;
}

export interface CaptureLeadResponse {
  leadId: string;
  nextQuestion?: string;
}

export interface GetSessionResponse {
  session: Session;
  lead?: Partial<Lead>;
}
