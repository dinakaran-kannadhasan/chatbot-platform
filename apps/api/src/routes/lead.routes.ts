import { Router, type Request, type Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { tenantResolver } from "../middleware/tenant.js";
import { LeadModel } from "../models/index.js";
import { marketoService } from "../services/marketo.service.js";
import type { UpdateLeadInput } from "@chatbot/types";

const router: Router = Router();

/**
 * POST /api/leads
 * Capture or update lead information from the chat.
 * Called when the user provides their details mid-conversation.
 */
router.post(
  "/",
  tenantResolver,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken, lead } = req.body as {
      sessionToken?: string;
      lead?: Record<string, string>;
    };

    if (!sessionToken || !lead) {
      throw new AppError(
        400,
        "MISSING_FIELDS",
        "sessionToken and lead are required",
      );
    }

    if (!lead["email"]) {
      throw new AppError(400, "MISSING_EMAIL", "lead.email is required");
    }

    /**
     * findOneAndUpdate with upsert: true.
     * Why upsert? The lead might already exist from a previous session.
     * We want to update it, not create a duplicate.
     * The unique index on email+websiteId enforces one lead per tenant.
     */
    const updatedLead = await LeadModel.findOneAndUpdate(
      { email: lead["email"].toLowerCase(), websiteId: req.websiteId },
      {
        $set: {
          ...lead,
          websiteId: req.websiteId,
          sessionId: sessionToken,
        },
        $setOnInsert: {
          status: "NEW",
          intentLevel: "EXPLORING",
        },
      },
      { upsert: true, new: true },
    );

    /**
     * Push to Marketo asynchronously.
     * Why not await? Marketo sync is a background concern.
     * The user gets an immediate response — Marketo syncs in background.
     * If Marketo fails, the lead is still in MongoDB.
     */
    if (updatedLead) {
      marketoService
        .syncLead({
          email: updatedLead.email,
          name: updatedLead.name,
          company: updatedLead.company,
          jobTitle: updatedLead.jobTitle,
          useCase: updatedLead.useCase,
          currentSolution: updatedLead.currentSolution,
          intentLevel: updatedLead.intentLevel,
          websiteId: updatedLead.websiteId,
        })
        .catch((err) => console.error("Background Marketo sync failed:", err));
    }

    res.status(201).json({
      success: true,
      data: { leadId: updatedLead?._id.toString() },
    });
  }),
);

/**
 * PATCH /api/leads/:id
 * Update a specific lead field.
 * Called as the conversation progresses and more info is collected.
 */
router.patch(
  "/:id",
  tenantResolver,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body as UpdateLeadInput;

    /**
     * Why check websiteId on update?
     * Prevents one tenant from updating another tenant's leads.
     * Always scope queries to the current tenant — never trust the ID alone.
     */
    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, websiteId: req.websiteId },
      { $set: updates },
      { new: true },
    );

    if (!lead) {
      throw new AppError(404, "LEAD_NOT_FOUND", "Lead not found");
    }

    res.json({ success: true, data: lead });
  }),
);

/**
 * GET /api/leads
 * List leads for a tenant. Used by the admin dashboard.
 */
router.get(
  "/",
  tenantResolver,
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
    const limit = Math.min(
      50,
      parseInt((req.query["limit"] as string) ?? "20"),
    );

    const [leads, total] = await Promise.all([
      LeadModel.find({ websiteId: req.websiteId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      LeadModel.countDocuments({ websiteId: req.websiteId }),
    ]);

    res.json({
      success: true,
      data: {
        items: leads,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

export default router;
