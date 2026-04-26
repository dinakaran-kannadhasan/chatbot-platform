import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { Lead, IntentLevel, LeadStatus } from "@chatbot/types";

export interface LeadDocument extends Omit<Lead, "id">, Document {}

export interface LeadModel extends Model<LeadDocument> {
  findByEmail(email: string, websiteId: string): Promise<LeadDocument | null>;
  findBySession(sessionId: string): Promise<LeadDocument | null>;
  findHighIntent(websiteId: string): Promise<LeadDocument[]>;
}

const leadSchema = new Schema<LeadDocument, LeadModel>(
  {
    sessionId: {
      type: String,
      required: [true, "sessionId is required"],
      index: true,
    },

    websiteId: {
      type: String,
      required: [true, "websiteId is required"],
      index: true,
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      minlength: [1, "name cannot be empty"],
      maxlength: [100, "name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
      lowercase: true,
      /**
       * Email validation at the DB layer.
       * Why regex instead of a library?
       * This regex covers 99.9% of real emails.
       * Libraries add weight — for a simple format check, regex is fine.
       * The real validation is when the user clicks a confirmation link.
       */
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "email must be a valid email address",
      },
    },

    company: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    useCase: { type: String, trim: true },
    currentSolution: { type: String, trim: true },

    intentLevel: {
      type: String,
      enum: {
        values: ["EXPLORING", "INTERESTED", "HIGH_INTENT"] as IntentLevel[],
        message: "Invalid intentLevel",
      },
      required: true,
      default: "EXPLORING",
    },

    status: {
      type: String,
      enum: {
        values: [
          "NEW",
          "QUALIFIED",
          "DEMO_REQUESTED",
          "SYNCED",
          "LOST",
        ] as LeadStatus[],
        message: "Invalid status",
      },
      required: true,
      default: "NEW",
    },

    marketoLeadId: { type: Number },
    marketoSyncedAt: { type: Date },
  },
  {
    timestamps: true,
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
 * Compound unique index — one lead per email per website.
 * The same person can be a lead for multiple clients (tenants)
 * but not duplicated within the same client.
 */
leadSchema.index({ email: 1, websiteId: 1 }, { unique: true });
leadSchema.index({ intentLevel: 1, websiteId: 1 });
leadSchema.index({ status: 1, websiteId: 1 });

leadSchema.statics["findByEmail"] = async function (
  email: string,
  websiteId: string,
): Promise<LeadDocument | null> {
  return this.findOne({
    email: email.toLowerCase().trim(),
    websiteId: websiteId.toLowerCase().trim(),
  });
};

leadSchema.statics["findBySession"] = async function (
  sessionId: string,
): Promise<LeadDocument | null> {
  return this.findOne({ sessionId });
};

leadSchema.statics["findHighIntent"] = async function (
  websiteId: string,
): Promise<LeadDocument[]> {
  return this.find({
    websiteId: websiteId.toLowerCase(),
    intentLevel: "HIGH_INTENT",
  }).sort({ createdAt: -1 });
};

export const LeadModel = mongoose.model<LeadDocument, LeadModel>(
  "Lead",
  leadSchema,
);
