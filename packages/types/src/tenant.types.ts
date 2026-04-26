import type { BaseDocument } from "./common.types.js";

export interface Tenant extends BaseDocument {
  websiteId: string;
  name: string;
  domain: string;
  systemPrompt: string;
  isActive: boolean;
  branding: TenantBranding;
  settings: TenantSettings;
}

export interface TenantBranding {
  primaryColor: string;
  logoUrl: string;
  botName: string;
  welcomeMessage: string;
}

export interface TenantSettings {
  collectLeads: boolean;
  demoBookingUrl: string;
  marketoEnabled: boolean;
  ragEnabled: boolean;
  maxMessagesPerSession: number;
}

export type CreateTenantInput = Omit<Tenant, keyof BaseDocument>;

export type UpdateTenantInput = Partial<
  Omit<Tenant, keyof BaseDocument | "websiteId">
>;
