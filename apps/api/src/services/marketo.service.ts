import axios, { type AxiosInstance } from "axios";
import { env } from "../config/env.js";
import type {
  MarketoLeadInput,
  MarketoTokenResponse,
  MarketoApiResponse,
} from "@chatbot/types";

/**
 * Marketo service — pushes captured leads to Marketo CRM.
 *
 * Why a class instead of functions?
 * The OAuth token must be cached between calls.
 * A class lets us store token + expiry as instance state.
 * Functions would need a module-level variable — a class
 * is cleaner and easier to test (instantiate with mock env).
 *
 * Token lifecycle:
 * 1. First lead push — fetch token, cache it, push lead
 * 2. Subsequent pushes — use cached token if not expired
 * 3. Token expires — fetch new token automatically
 *
 * This pattern is called "lazy token refresh" and is the
 * standard approach for OAuth client credentials flow.
 */
class MarketoService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly http: AxiosInstance;

  constructor() {
    /**
     * Why a dedicated axios instance?
     * Base URL and timeout set once — not repeated on every call.
     * Interceptors can be added later for logging/retry.
     */
    this.http = axios.create({
      baseURL: env.MARKETO_BASE_URL,
      timeout: 10000, // 10 seconds — Marketo can be slow
    });
  }

  /**
   * Get a valid access token.
   * Returns cached token if still valid, otherwise fetches a new one.
   *
   * Why subtract 60000ms (1 minute) from expiry?
   * Clock skew — the token might expire between when we check
   * and when Marketo receives our request.
   * Refreshing 1 minute early prevents race conditions.
   */
  private async getToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await this.http.get<MarketoTokenResponse>(
      "/identity/oauth/token",
      {
        params: {
          grant_type: "client_credentials",
          client_id: env.MARKETO_CLIENT_ID,
          client_secret: env.MARKETO_CLIENT_SECRET,
        },
      },
    );

    this.accessToken = response.data.access_token;
    // expires_in is in seconds — convert to ms, subtract 1 min buffer
    this.tokenExpiresAt = now + response.data.expires_in * 1000 - 60000;

    return this.accessToken;
  }

  /**
   * Push a lead to Marketo.
   *
   * action: 'createOrUpdate' — if lead exists (matched by email),
   * update it. If not, create it. This is idempotent — safe to
   * call multiple times for the same lead.
   *
   * lookupField: 'email' — Marketo uses email as the unique
   * identifier to match existing leads.
   *
   * Returns the Marketo lead ID on success.
   */
  async pushLead(lead: MarketoLeadInput): Promise<number | null> {
    /**
     * Skip in test environment — never make real Marketo calls in tests.
     * Real CRM calls in tests would:
     * 1. Create fake leads in your production/staging Marketo
     * 2. Trigger real email nurture sequences
     * 3. Fail when Marketo credentials aren't set
     */
    if (env.NODE_ENV === "test") {
      return null;
    }

    try {
      const token = await this.getToken();

      const response = await this.http.post<MarketoApiResponse>(
        "/rest/v1/leads.json",
        {
          action: "createOrUpdate",
          lookupField: "email",
          input: [lead],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.data.success) {
        const errors = response.data.errors ?? [];
        console.error("Marketo push failed:", errors);
        return null;
      }

      const result = response.data.result?.[0];
      if (!result) return null;

      console.log(`Marketo lead ${result.status}: id=${result.id}`);
      return result.id;
    } catch (error) {
      /**
       * Marketo failure is non-fatal — same pattern as RAG.
       * If Marketo is down, the lead is still in MongoDB.
       * A background job can retry failed syncs later.
       */
      console.error("Marketo push error:", error);
      return null;
    }
  }

  /**
   * Sync a lead from our DB to Marketo.
   * Maps our internal Lead fields to Marketo field names.
   *
   * Why a separate method from pushLead?
   * pushLead takes the raw Marketo shape.
   * syncLead takes our internal Lead shape and transforms it.
   * This is the anti-corruption layer — our domain stays clean.
   */
  async syncLead(lead: {
    email: string;
    name: string;
    company?: string;
    jobTitle?: string;
    useCase?: string;
    currentSolution?: string;
    intentLevel: string;
    websiteId: string;
  }): Promise<number | null> {
    const [firstName, ...lastParts] = lead.name.split(" ");
    const lastName = lastParts.join(" ") || "";

    return this.pushLead({
      email: lead.email,
      firstName: firstName ?? lead.name,
      company: lead.company,
      title: lead.jobTitle,
      LeadSource: "Website Chatbot",
      Use_Case__c: lead.useCase,
      Intent_Level__c: lead.intentLevel,
      Current_Solution__c: lead.currentSolution,
    });
  }
}

/**
 * Export a singleton instance.
 * Why singleton? The token cache lives on the instance.
 * Multiple instances = multiple token fetches = wasted API calls.
 */
export const marketoService = new MarketoService();
