import { Router, type Request, type Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { TenantModel } from "../models/index.js";
import type { CreateTenantInput, UpdateTenantInput } from "@chatbot/types";

const router: Router = Router();

/**
 * Helper to safely extract a string param from req.params.
 * Express types params as string | string[] — we always
 * expect a single string for named route params like :websiteId.
 */
function getParam(req: Request, key: string): string {
  const value = req.params[key];
  if (!value || Array.isArray(value)) {
    throw new AppError(
      400,
      "INVALID_PARAM",
      `Route parameter '${key}' is required`,
    );
  }
  return value;
}

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateTenantInput;
    const tenant = await TenantModel.create(input);
    res.status(201).json({ success: true, data: tenant });
  }),
);

router.get(
  "/:websiteId",
  asyncHandler(async (req: Request, res: Response) => {
    const websiteId = getParam(req, "websiteId");
    const tenant = await TenantModel.findByWebsiteId(websiteId);
    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }
    res.json({ success: true, data: tenant });
  }),
);

router.patch(
  "/:websiteId",
  asyncHandler(async (req: Request, res: Response) => {
    const websiteId = getParam(req, "websiteId");
    const updates = req.body as UpdateTenantInput;
    const tenant = await TenantModel.findOneAndUpdate(
      { websiteId },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }
    res.json({ success: true, data: tenant });
  }),
);

router.delete(
  "/:websiteId",
  asyncHandler(async (req: Request, res: Response) => {
    const websiteId = getParam(req, "websiteId");
    const tenant = await TenantModel.findOneAndUpdate(
      { websiteId },
      { $set: { isActive: false } },
      { new: true },
    );
    if (!tenant) {
      throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");
    }
    res.json({
      success: true,
      data: { message: `Tenant ${websiteId} deactivated` },
    });
  }),
);

export default router;
