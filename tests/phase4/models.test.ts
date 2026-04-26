import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { TenantModel } from "../../apps/api/src/models/Tenant.model.js";
import { SessionModel } from "../../apps/api/src/models/Session.model.js";
import { LeadModel } from "../../apps/api/src/models/Lead.model.js";
import { startTestDB, stopTestDB, clearTestDB } from "../helpers/mongodb.js";

beforeAll(async () => {
  await startTestDB();
});

afterAll(async () => {
  await stopTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

// ─── Tenant Model Tests ───────────────────────────────────────────────────────

describe("Phase 4 — TenantModel", () => {
  const validTenant = {
    websiteId: "appviewx",
    name: "AppViewX",
    domain: "appviewx.com",
    systemPrompt:
      "You are a helpful sales assistant for AppViewX. Only answer questions about AppViewX products and services.",
    isActive: true,
    branding: {
      primaryColor: "#0057FF",
      logoUrl: "https://appviewx.com/logo.png",
      botName: "AVX Assistant",
      welcomeMessage: "Hi! How can I help you today?",
    },
    settings: {
      collectLeads: true,
      demoBookingUrl: "https://appviewx.com/demo",
      marketoEnabled: true,
      ragEnabled: true,
      maxMessagesPerSession: 50,
    },
  };

  it("creates a tenant with valid data", async () => {
    const tenant = await TenantModel.create(validTenant);
    expect(tenant.id).toBeDefined();
    expect(tenant.websiteId).toBe("appviewx");
    expect(tenant.name).toBe("AppViewX");
    expect(tenant.createdAt).toBeInstanceOf(Date);
  });

  it("normalizes websiteId to lowercase", async () => {
    const tenant = await TenantModel.create({
      ...validTenant,
      websiteId: "AppViewX",
    });
    expect(tenant.websiteId).toBe("appviewx");
  });

  it("rejects duplicate websiteId", async () => {
    await TenantModel.create(validTenant);
    await expect(TenantModel.create(validTenant)).rejects.toThrow();
  });

  it("rejects invalid hex color", async () => {
    await expect(
      TenantModel.create({
        ...validTenant,
        branding: { ...validTenant.branding, primaryColor: "notacolor" },
      }),
    ).rejects.toThrow("primaryColor must be a valid hex color");
  });

  it("rejects websiteId with invalid characters", async () => {
    await expect(
      TenantModel.create({ ...validTenant, websiteId: "app viewx!" }),
    ).rejects.toThrow();
  });

  it("rejects short systemPrompt", async () => {
    await expect(
      TenantModel.create({ ...validTenant, systemPrompt: "too short" }),
    ).rejects.toThrow();
  });

  it("findByWebsiteId returns correct tenant", async () => {
    await TenantModel.create(validTenant);
    const found = await TenantModel.findByWebsiteId("appviewx");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("AppViewX");
  });

  it("findByWebsiteId is case insensitive", async () => {
    await TenantModel.create(validTenant);
    const found = await TenantModel.findByWebsiteId("APPVIEWX");
    expect(found).not.toBeNull();
  });

  it("findByWebsiteId returns null for unknown tenant", async () => {
    const found = await TenantModel.findByWebsiteId("unknown");
    expect(found).toBeNull();
  });

  it("toJSON maps _id to id", async () => {
    const tenant = await TenantModel.create(validTenant);
    const json = tenant.toJSON();
    expect(json["id"]).toBeDefined();
    expect(json["_id"]).toBeUndefined();
    expect(json["__v"]).toBeUndefined();
  });
});

// ─── Session Model Tests ──────────────────────────────────────────────────────

describe("Phase 4 — SessionModel", () => {
  const validSession = {
    websiteId: "appviewx",
    sessionToken: "tok_abc123def456",
    messages: [],
    intentLevel: "EXPLORING" as const,
    metadata: {
      userAgent: "Mozilla/5.0",
      ipAddress: "192.168.1.1",
      pageUrl: "/products",
    },
  };

  it("creates a session with valid data", async () => {
    const session = await SessionModel.create(validSession);
    expect(session.id).toBeDefined();
    expect(session.intentLevel).toBe("EXPLORING");
    expect(session.messages).toHaveLength(0);
  });

  it("defaults intentLevel to EXPLORING", async () => {
    const session = await SessionModel.create({
      ...validSession,
      intentLevel: undefined,
    });
    expect(session.intentLevel).toBe("EXPLORING");
  });

  it("stores messages correctly", async () => {
    const session = await SessionModel.create({
      ...validSession,
      messages: [
        { role: "user", content: "Hello", timestamp: new Date() },
        { role: "assistant", content: "Hi there!", timestamp: new Date() },
      ],
    });
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]?.role).toBe("user");
    expect(session.messages[1]?.role).toBe("assistant");
  });

  it("rejects invalid intentLevel", async () => {
    await expect(
      SessionModel.create({ ...validSession, intentLevel: "INVALID" as never }),
    ).rejects.toThrow();
  });

  it("rejects duplicate sessionToken", async () => {
    await SessionModel.create(validSession);
    await expect(SessionModel.create(validSession)).rejects.toThrow();
  });

  it("findByToken returns correct session", async () => {
    await SessionModel.create(validSession);
    const found = await SessionModel.findByToken("tok_abc123def456");
    expect(found).not.toBeNull();
    expect(found?.websiteId).toBe("appviewx");
  });

  it("findByToken returns null for unknown token", async () => {
    const found = await SessionModel.findByToken("unknown_token");
    expect(found).toBeNull();
  });

  it("findActiveByWebsite returns sessions in desc order", async () => {
    await SessionModel.create({ ...validSession, sessionToken: "tok_1" });
    await SessionModel.create({ ...validSession, sessionToken: "tok_2" });
    const sessions = await SessionModel.findActiveByWebsite("appviewx");
    expect(sessions).toHaveLength(2);
  });

  it("toJSON maps _id to id", async () => {
    const session = await SessionModel.create(validSession);
    const json = session.toJSON();
    expect(json["id"]).toBeDefined();
    expect(json["_id"]).toBeUndefined();
  });
});

// ─── Lead Model Tests ─────────────────────────────────────────────────────────

describe("Phase 4 — LeadModel", () => {
  const validLead = {
    sessionId: "sess_abc123",
    websiteId: "appviewx",
    name: "Arun Kumar",
    email: "arun@appviewx.com",
    intentLevel: "HIGH_INTENT" as const,
    status: "NEW" as const,
  };

  it("creates a lead with required fields only", async () => {
    const lead = await LeadModel.create(validLead);
    expect(lead.id).toBeDefined();
    expect(lead.email).toBe("arun@appviewx.com");
    expect(lead.status).toBe("NEW");
  });

  it("normalizes email to lowercase", async () => {
    const lead = await LeadModel.create({
      ...validLead,
      email: "ARUN@APPVIEWX.COM",
    });
    expect(lead.email).toBe("arun@appviewx.com");
  });

  it("creates a lead with all optional fields", async () => {
    const lead = await LeadModel.create({
      ...validLead,
      company: "AppViewX Inc",
      jobTitle: "Security Engineer",
      useCase: "PKI automation",
      currentSolution: "Manual certificates",
    });
    expect(lead.company).toBe("AppViewX Inc");
    expect(lead.useCase).toBe("PKI automation");
  });

  it("rejects invalid email", async () => {
    await expect(
      LeadModel.create({ ...validLead, email: "not-an-email" }),
    ).rejects.toThrow("email must be a valid email address");
  });

  it("rejects invalid intentLevel", async () => {
    await expect(
      LeadModel.create({ ...validLead, intentLevel: "UNKNOWN" as never }),
    ).rejects.toThrow();
  });

  it("rejects invalid status", async () => {
    await expect(
      LeadModel.create({ ...validLead, status: "INVALID" as never }),
    ).rejects.toThrow();
  });

  it("enforces unique email per websiteId", async () => {
    await LeadModel.create(validLead);
    await expect(LeadModel.create(validLead)).rejects.toThrow();
  });

  it("allows same email on different websites", async () => {
    await LeadModel.create(validLead);
    const lead2 = await LeadModel.create({
      ...validLead,
      websiteId: "other-client",
    });
    expect(lead2.id).toBeDefined();
  });

  it("findByEmail returns correct lead", async () => {
    await LeadModel.create(validLead);
    const found = await LeadModel.findByEmail("arun@appviewx.com", "appviewx");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Arun Kumar");
  });

  it("findByEmail is case insensitive", async () => {
    await LeadModel.create(validLead);
    const found = await LeadModel.findByEmail("ARUN@APPVIEWX.COM", "appviewx");
    expect(found).not.toBeNull();
  });

  it("findBySession returns correct lead", async () => {
    await LeadModel.create(validLead);
    const found = await LeadModel.findBySession("sess_abc123");
    expect(found).not.toBeNull();
  });

  it("findHighIntent returns only HIGH_INTENT leads", async () => {
    await LeadModel.create(validLead);
    await LeadModel.create({
      ...validLead,
      email: "other@test.com",
      intentLevel: "EXPLORING",
    });
    const highIntent = await LeadModel.findHighIntent("appviewx");
    expect(highIntent).toHaveLength(1);
    expect(highIntent[0]?.intentLevel).toBe("HIGH_INTENT");
  });

  it("toJSON maps _id to id", async () => {
    const lead = await LeadModel.create(validLead);
    const json = lead.toJSON();
    expect(json["id"]).toBeDefined();
    expect(json["_id"]).toBeUndefined();
  });
});
