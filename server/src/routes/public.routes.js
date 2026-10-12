import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { listPublicTemplates, getPublicTemplate } from "../services/templateCatalogue.service.js";
import { describeCatalogue } from "../services/entitlements.service.js";
import { createEnquiry } from "../services/salesEnquiry.service.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import { salesEnquiryLimiter } from "../middlewares/rateLimit.middleware.js";

// What the public site may show without anyone signing in.
// Nothing here returns a template's wording. The one thing taken in is an enquiry for sales.
const router = Router();

const cacheBriefly = (res) => res.setHeader("Cache-Control", "public, max-age=300");

router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    cacheBriefly(res);
    res.json(new ApiResponse(await listPublicTemplates(), "Templates"));
  })
);

router.get(
  "/templates/:key",
  asyncHandler(async (req, res) => {
    cacheBriefly(res);
    res.json(new ApiResponse(await getPublicTemplate(req.params.key), "Template"));
  })
);

// Plans and prices, for the pricing page
router.get("/plans", (req, res) => {
  cacheBriefly(res);
  res.json(new ApiResponse(describeCatalogue(), "Plans"));
});

// "Contact sales", for a plan that is agreed with us and not bought with a button
router.post(
  "/sales-enquiries",
  salesEnquiryLimiter,
  validate({ body: schemas.salesEnquiry }),
  asyncHandler(async (req, res) => {
    // A filled-in box no person can see is a program filling in forms: thanked, and not kept
    const { website, ...enquiry } = req.body;
    if (!website) await createEnquiry(enquiry);
    res.status(201).json(new ApiResponse({}, "Thank you. We will write to you soon."));
  })
);

export default router;
