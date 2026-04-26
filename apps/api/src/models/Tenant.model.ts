import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { Tenant, TenantBranding, TenantSettings } from "@chatbot/types";

/**
 * Why TenantDocument extends both Document and Tenant?
 *
 * Mongoose's Document adds methods like .save(), .toObject()
 * Our Tenant interface defines the business data shape.
 * Combining them gives us a type that has BOTH —
 * the data fields AND the Mongoose methods.
 *
 * We Omit 'id' from Tenant because Mongoose uses '_id' internally
 * and maps it to 'id' via a virtual — having both causes conflicts.
 */
export interface TenantDocument extends Omit<Tenant, "id">, Document {}

/**
 * Why define a TenantModel interface?
 * It lets us add static methods to the model with full type safety.
 * e.g. Tenant.findByWebsiteId('appviewx') instead of
 *      Tenant.findOne({ websiteId: 'appviewx' })
 * Static methods are more readable and centralize query logic.
 */
export interface TenantModel extends Model<TenantDocument> {
  findByWebsiteId(websiteId: string): Promise<TenantDocument | null>;
}

const brandingSchema = new Schema<TenantBranding>(
  {
    primaryColor: {
      type: String,
      required: true,
      default: "#0057FF",
      /**
       * validate ensures colors are valid hex codes.
       * Bad data rejected at the DB layer — not in business logic.
       * This is the "validate at the boundary" principle.
       */
      validate: {
        validator: (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v),
        message: "primaryColor must be a valid hex color e.g. #0057FF",
      },
    },
    logoUrl: { type: String, required: true },
    botName: { type: String, required: true, trim: true },
    welcomeMessage: { type: String, required: true, trim: true },
  },
  { _id: false }, // no separate _id for subdocuments — they're embedded
);

const settingsSchema = new Schema<TenantSettings>(
  {
    collectLeads: { type: Boolean, required: true, default: true },
    demoBookingUrl: { type: String, required: true },
    marketoEnabled: { type: Boolean, required: true, default: false },
    ragEnabled: { type: Boolean, required: true, default: true },
    maxMessagesPerSession: {
      type: Number,
      required: true,
      default: 50,
      min: [1, "maxMessagesPerSession must be at least 1"],
      max: [500, "maxMessagesPerSession cannot exceed 500"],
    },
  },
  { _id: false },
);

const tenantSchema = new Schema<TenantDocument, TenantModel>(
  {
    websiteId: {
      type: String,
      required: [true, "websiteId is required"],
      unique: true,
      trim: true,
      lowercase: true,
      /**
       * Why lowercase + trim?
       * Prevents duplicate tenants from case differences:
       * 'AppViewX' and 'appviewx' would be different without this.
       * Always normalize identifiers at the schema level.
       */
      validate: {
        validator: (v: string) => /^[a-z0-9-]+$/.test(v),
        message:
          "websiteId can only contain lowercase letters, numbers, hyphens",
      },
    },
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, "Domain is required"],
      trim: true,
      lowercase: true,
    },
    systemPrompt: {
      type: String,
      required: [true, "systemPrompt is required"],
      minlength: [50, "systemPrompt must be at least 50 characters"],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    branding: {
      type: brandingSchema,
      required: true,
    },
    settings: {
      type: settingsSchema,
      required: true,
    },
  },
  {
    /**
     * timestamps: true automatically adds createdAt and updatedAt.
     * Mongoose manages these — never set them manually.
     */
    timestamps: true,

    /**
     * toJSON transform maps _id → id for API responses.
     * Why? Our TypeScript types use 'id' not '_id'.
     * The transform runs automatically when res.json() serializes docs.
     */
    toJSON: {
      transform(_doc, ret) {
        const record = ret as Record<string, unknown>;
        record["id"] = record["_id"];
        delete record["_id"];
        delete record["__v"];
        return record;
      },
    },
  },
);

/**
 * Indexes — critical for query performance.
 *
 * websiteId is already unique: true above, which creates an index.
 * We add a compound index on domain + isActive because the CORS
 * middleware queries: "find tenant with this domain that is active"
 */
tenantSchema.index({ domain: 1, isActive: 1 });

/**
 * Static method — findByWebsiteId.
 *
 * Why a static method instead of inline .findOne()?
 * 1. One place to change if the field name changes
 * 2. Can add caching here later (Redis) without changing callers
 * 3. Easier to test — mock one method not all of findOne
 */
tenantSchema.statics["findByWebsiteId"] = async function (
  websiteId: string,
): Promise<TenantDocument | null> {
  return this.findOne({ websiteId: websiteId.toLowerCase().trim() });
};

export const TenantModel = mongoose.model<TenantDocument, TenantModel>(
  "Tenant",
  tenantSchema,
);
