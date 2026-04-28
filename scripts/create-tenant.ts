import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;

// Tenant schema (mirrors your Tenant.model.ts)
const tenantSchema = new mongoose.Schema(
  {
    websiteId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    domain: { type: String, required: true },
    systemPrompt: { type: String, required: true },
    branding: {
      primaryColor: { type: String, default: "#185fa5" },
      botName: { type: String, default: "AVX Assistant" },
      welcomeMessage: { type: String },
    },
    settings: {
      maxMessagesPerSession: { type: Number, default: 50 },
      sessionTTLDays: { type: Number, default: 30 },
      enableLeadCapture: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }, 
);

const Tenant = mongoose.model("Tenant", tenantSchema);

const APPVIEWX_TENANT = {
  websiteId: "appviewx",
  name: "AppViewX",
  domain: "appviewx.com",
  systemPrompt: `You are AVX Assistant, an AI Sales Assistant for AppViewX — a leading machine identity management platform.

Your role is to:
- Answer questions about AppViewX products, features, and use cases
- Help visitors understand certificate lifecycle management (CLM), PKI automation, and secrets management
- Qualify leads and guide them toward booking a demo
- Collect contact information naturally during conversation

AppViewX products include:
- CERT+: Certificate lifecycle management and automation
- AVX ONE: Unified machine identity management platform  
- PKI as a Service: Cloud-based PKI infrastructure
- Secrets Manager: Enterprise secrets and credentials management

Always be helpful, professional, and focused on understanding the visitor's needs before recommending solutions.`,
  branding: {
    primaryColor: "#185fa5",
    botName: "AVX Assistant",
    welcomeMessage:
      "Hi! I'm AVX Assistant. How can I help you with machine identity management today?",
  },
  settings: {
    maxMessagesPerSession: 50,
    sessionTTLDays: 30,
    enableLeadCapture: true,
  },
  isActive: true,
};

async function createTenant() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected");

  try {
    // Check if tenant already exists
    const existing = await Tenant.findOne({ websiteId: "appviewx" });

    if (existing) {
      console.log("⚠️  Tenant 'appviewx' already exists — updating...");
      await Tenant.updateOne({ websiteId: "appviewx" }, APPVIEWX_TENANT);
      console.log("✅ Tenant updated successfully");
    } else {
      await Tenant.create(APPVIEWX_TENANT);
      console.log("✅ Tenant 'appviewx' created successfully");
    }

    const tenant = await Tenant.findOne({ websiteId: "appviewx" });
    console.log("\n📋 Tenant details:");
    console.log(JSON.stringify(tenant, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

createTenant();
