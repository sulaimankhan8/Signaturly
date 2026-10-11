import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { listPublicTemplates, getPublicTemplate } from "../services/templateCatalogue.service.js";
import { publicCatalogue } from "../config/plans.js";

// What the public site may show without anyone signing in.
// Nothing here takes input beyond a template key, and nothing here returns a template's wording.
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
  res.json(new ApiResponse(publicCatalogue(), "Plans"));
});

export default router;
