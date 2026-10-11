import starter from "./packs/starter.js";
import general from "./packs/general.js";
import rentals from "./packs/rentals.js";
import society from "./packs/society.js";
import hr from "./packs/hr.js";
import professional from "./packs/professional.js";
import lending from "./packs/lending.js";
import realestate from "./packs/realestate.js";

/**
 * The template packs, and the lowest plan tier that can use each.
 * Which plan belongs to which tier is decided in services/entitlements.service.js.
 *
 * A pack with no templates yet is listed so its place in the plans is fixed before its
 * content is written.
 */
export const PACKS = {
  starter: { name: "Starter", tier: "free", description: "Everyday documents for anyone." },
  general: { name: "General business", tier: "pro", description: "Common commercial agreements in generic wording." },
  rentals: { name: "Rentals", tier: "pro", description: "Letting homes, shops and rooms." },
  society: { name: "Housing society", tier: "pro", description: "Forms, notices and letters for housing societies." },
  hr: { name: "HR and staffing", tier: "pro", description: "From appointment to full-and-final settlement." },
  professional: { name: "Professional firms", tier: "pro", description: "Engagement letters, resolutions and consents." },
  sales: { name: "Sales and agencies", tier: "pro", description: "Proposals, orders and dealer agreements." },
  education: { name: "Education and clinics", tier: "pro", description: "Admissions, consents and enrolment." },
  realestate: { name: "Real estate sales", tier: "enterprise", description: "Brokerage, booking and possession." },
  lending: { name: "Lending", tier: "enterprise", description: "Loan papers for regulated lenders." },
};

// The templates that ship with the code. They are copied into the database by syncCatalogue
// and never overwrite a version that is already there.
export const SEED_DEFINITIONS = [...starter, ...general, ...rentals, ...society, ...hr, ...professional, ...lending, ...realestate];
