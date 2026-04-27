import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import request from "supertest";
import app from "../../apps/api/src/app.js";
import { redis } from "../../apps/api/src/db/redis.js";
import { startTestDB, stopTestDB, clearTestDB } from "../helpers/mongodb.js";
import { TenantModel } from "../../apps/api/src/models/index.js";
import { SessionModel } from "../../apps/api/src/models/index.js";

/**
 * Mock the AI and CRM services — we test HTTP routing,
 * request validation, and response shapes here.
 * The actual AI logic is tested in phase5 tests.
 */
vi.mock("../../apps/api/src/services/claude.service.js", () => ({
  streamChatResponse: vi
    .fn()
    .mockImplementation(async (_messages, _prompt, onChunk) => {
      onChunk({ delta: "Hello", done: false });
      onChunk({ delta: " there!", done: true });
      return {
        fullText: "Hello there!",
        intentUpdate: undefined,
        leadCapture: undefined,
      };
    }),
  buildSystemPrompt: vi.fn().mockReturnValue("mocked system prompt"),
}));

vi.mock("../../apps/api/src/services/rag.service.js", () => ({
  retrieveContext: vi.fn().mockResolvedValue([]),
  formatContext: vi.fn().mockReturnValue(""),
}));

vi.mock("../../apps/api/src/services/marketo.service.js", () => ({
  marketoService: {
    syncLead: vi.fn().mockResolvedValue(null),
    pushLead: vi.fn().mockResolvedValue(null),
  },
}));

const validTenant = {
  websiteId: "test-site",
  name: "Test Site",
  domain: "testsite.com",
  systemPrompt:
    "You are a helpful assistant for Test Site. Answer questions about our products and services accurately.",
  isActive: true,
  branding: {
    primaryColor: "#0057FF",
    logoUrl: "https://testsite.com/logo.png",
    botName: "Test Bot",
    welcomeMessage: "Hi! How can I help?",
  },
  settings: {
    collectLeads: true,
    demoBookingUrl: "https://testsite.com/demo",
    marketoEnabled: false,
    ragEnabled: false,
    maxMessagesPerSession: 50,
  },
};

beforeAll(async () => {
  await startTestDB();
});

afterAll(async () => {
  await stopTestDB();
  await redis.quit().catch(() => {});
});

beforeEach(async () => {
  await clearTestDB();
});

// ─── Tenant Routes ────────────────────────────────────────────────────────────

describe("Phase 6 — Tenant Routes", () => {
  it("POST /api/tenants creates a tenant", async () => {
    const res = await request(app).post("/api/tenants").send(validTenant);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.websiteId).toBe("test-site");
  });

  it("POST /api/tenants rejects invalid hex color", async () => {
    const res = await request(app)
      .post("/api/tenants")
      .send({
        ...validTenant,
        branding: { ...validTenant.branding, primaryColor: "notacolor" },
      });
    expect(res.status).toBe(400); // ← Mongoose ValidationError → 400
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/tenants/:websiteId returns tenant", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app).get("/api/tenants/test-site");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Test Site");
  });

  it("GET /api/tenants/:websiteId returns 404 for unknown", async () => {
    const res = await request(app).get("/api/tenants/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("PATCH /api/tenants/:websiteId updates tenant", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .patch("/api/tenants/test-site")
      .send({ name: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Name");
  });

  it("DELETE /api/tenants/:websiteId deactivates tenant", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app).delete("/api/tenants/test-site");
    expect(res.status).toBe(200);
    const tenant = await TenantModel.findByWebsiteId("test-site");
    expect(tenant?.isActive).toBe(false);
  });
});

// ─── Chat Routes ──────────────────────────────────────────────────────────────

describe("Phase 6 — Chat Routes", () => {
  it("POST /api/chat/session requires X-Website-Id header", async () => {
    const res = await request(app)
      .post("/api/chat/session")
      .send({ pageUrl: "/" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_WEBSITE_ID");
  });

  it("POST /api/chat/session creates session for valid tenant", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .post("/api/chat/session")
      .set("X-Website-Id", "test-site")
      .send({ pageUrl: "/home" });
    expect(res.status).toBe(201);
    expect(res.body.data.sessionToken).toBeDefined();
    expect(res.body.data.welcomeMessage).toBe("Hi! How can I help?");
  });

  it("POST /api/chat/session returns 404 for unknown tenant", async () => {
    const res = await request(app)
      .post("/api/chat/session")
      .set("X-Website-Id", "unknown-site")
      .send({ pageUrl: "/" });
    expect(res.status).toBe(404);
  });

  it("POST /api/chat/message requires sessionToken", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .post("/api/chat/message")
      .set("X-Website-Id", "test-site")
      .send({ message: "Hello" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_SESSION_TOKEN");
  });

  it("POST /api/chat/message requires message", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .post("/api/chat/message")
      .set("X-Website-Id", "test-site")
      .send({ sessionToken: "tok_123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_MESSAGE");
  });

  it("POST /api/chat/message rejects messages over 2000 chars", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .post("/api/chat/message")
      .set("X-Website-Id", "test-site")
      .send({ sessionToken: "tok_123", message: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MESSAGE_TOO_LONG");
  });

  it("POST /api/chat/message streams response for valid session", async () => {
    await TenantModel.create(validTenant);

    // Create a session first
    const sessionRes = await request(app)
      .post("/api/chat/session")
      .set("X-Website-Id", "test-site")
      .send({ pageUrl: "/home" });

    const { sessionToken } = sessionRes.body.data as { sessionToken: string };

    const res = await request(app)
      .post("/api/chat/message")
      .set("X-Website-Id", "test-site")
      .send({ sessionToken, message: "Hello" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("data:");
  });
});

// ─── Lead Routes ──────────────────────────────────────────────────────────────

describe("Phase 6 — Lead Routes", () => {
  it("POST /api/leads requires X-Website-Id", async () => {
    const res = await request(app)
      .post("/api/leads")
      .send({ sessionToken: "tok_123", lead: { email: "test@test.com" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_WEBSITE_ID");
  });

  it("POST /api/leads requires email", async () => {
    const res = await request(app)
      .post("/api/leads")
      .set("X-Website-Id", "test-site")
      .send({ sessionToken: "tok_123", lead: { name: "Test" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_EMAIL");
  });

  it("GET /api/leads returns paginated leads", async () => {
    await TenantModel.create(validTenant);
    const res = await request(app)
      .get("/api/leads")
      .set("X-Website-Id", "test-site");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("items");
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("totalPages");
  });
});
