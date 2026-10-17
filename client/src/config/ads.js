/**
 * Monetization and Ad Network Configuration
 * Active Network: Monetag (In-Page Push Zone 12054833)
 */

export const MONETAG_CONFIG = {
  enabled: import.meta.env.VITE_MONETAG_ENABLED !== "false",
  zoneId: import.meta.env.VITE_MONETAG_ZONE_ID || "12054833",
  scriptUrl: import.meta.env.VITE_MONETAG_SCRIPT_URL || "https://nap5k.com/tag.min.js",
};

/**
 * Determines whether a user or visitor is eligible to see ads.
 * Pro, Business, and Enterprise plans are strictly 100% ad-free.
 */
export const isAdEligibleUser = (user) => {
  if (!user) return true; // Unauthenticated guests/visitors are eligible
  const plan = user?.subscription?.plan || user?.plan || "free";
  return plan === "free";
};
