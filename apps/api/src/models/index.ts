/**
 * Barrel export for all models.
 * Import from here, not from individual model files:
 *
 * import { TenantModel, SessionModel, LeadModel } from '../models/index.js';
 *
 * This makes refactoring easier — if a model file moves,
 * only this barrel file needs updating.
 */
export { TenantModel } from "./Tenant.model.js";
export { SessionModel } from "./Session.model.js";
export { LeadModel } from "./Lead.model.js";

export type {
  TenantDocument,
  TenantModel as TenantModelType,
} from "./Tenant.model.js";
export type {
  SessionDocument,
  SessionModel as SessionModelType,
} from "./Session.model.js";
export type { LeadDocument, LeadModel as LeadModelType } from "./Lead.model.js";
