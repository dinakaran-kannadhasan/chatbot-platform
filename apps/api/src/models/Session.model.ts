import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  Session,
  Message,
  SessionMetadata,
  IntentLevel,
} from "@chatbot/types";

export interface SessionDocument extends Omit<Session, "id">, Document {}

export interface SessionModel extends Model<SessionDocument> {
  findByToken(sessionToken: string): Promise<SessionDocument | null>;
  findActiveByWebsite(
    websiteId: string,
    limit?: number,
  ): Promise<SessionDocument[]>;
}

/**
 * Message subdocument schema.
 * Messages are embedded in the Session document — not a separate collection.
 *
 * Why embed instead of reference?
 * A session always needs its messages together.
 * Embedding = one DB read to get everything.
 * Referencing = two reads (session + messages join).
 * For chat history, embedding is always faster.
 */
const messageSchema = new Schema<Message>(
  {
    role: {
      type: String,
      enum: {
        values: ["user", "assistant"],
        message: "role must be user or assistant",
      },
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      maxlength: [10000, "Message content cannot exceed 10000 characters"],
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }, // messages don't need their own _id
);

const metadataSchema = new Schema<SessionMetadata>(
  {
    userAgent: { type: String, required: true, default: "unknown" },
    ipAddress: { type: String, required: true, default: "unknown" },
    referrer: { type: String },
    pageUrl: { type: String, required: true, default: "/" },
    resolvedAt: { type: Date },
  },
  { _id: false },
);

const sessionSchema = new Schema<SessionDocument, SessionModel>(
  {
    websiteId: {
      type: String,
      required: [true, "websiteId is required"],
      index: true,
      lowercase: true,
      trim: true,
    },

    sessionToken: {
      type: String,
      required: [true, "sessionToken is required"],
      unique: true,
      index: true,
      /**
       * Sessions are looked up by token on every message.
       * unique: true creates an index automatically.
       * This makes the lookup O(log n) not O(n).
       */
    },

    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: (msgs: Message[]) => msgs.length <= 500,
        message: "Session cannot exceed 500 messages",
      },
    },

    intentLevel: {
      type: String,
      enum: {
        values: ["EXPLORING", "INTERESTED", "HIGH_INTENT"] as IntentLevel[],
        message: "intentLevel must be EXPLORING, INTERESTED, or HIGH_INTENT",
      },
      required: true,
      default: "EXPLORING",
    },

    leadId: {
      type: String,
      /**
       * leadId is optional — set only when the visitor
       * provides their name/email. Starts as undefined.
       */
    },

    metadata: {
      type: metadataSchema,
      required: true,
    },
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
 * TTL index — automatically deletes sessions after 30 days.
 *
 * Why TTL instead of a cron job?
 * MongoDB handles deletion automatically — no separate cleanup process.
 * 30 days covers all reasonable sales cycles.
 * Keeps the collection from growing unbounded.
 */
sessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

sessionSchema.index({ websiteId: 1, createdAt: -1 });

sessionSchema.statics["findByToken"] = async function (
  sessionToken: string,
): Promise<SessionDocument | null> {
  return this.findOne({ sessionToken });
};

sessionSchema.statics["findActiveByWebsite"] = async function (
  websiteId: string,
  limit = 20,
): Promise<SessionDocument[]> {
  return this.find({ websiteId: websiteId.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const SessionModel = mongoose.model<SessionDocument, SessionModel>(
  "Session",
  sessionSchema,
);
