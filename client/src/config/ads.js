/**
 * Monetization and Ad Network Configuration
 * Active Network: Monetag
 * - Zone 12054833: In-Page Push (Dashboard, Public Pages)
 * - Zone 12054837: Vignette / Interstitial (Pre-Signing Sponsor Gate)
 */

export const MONETAG_CONFIG = {
  enabled: import.meta.env.VITE_MONETAG_ENABLED !== "false",
  inPage: {
    zoneId: import.meta.env.VITE_MONETAG_INPAGE_ZONE_ID || "12054833",
    scriptUrl: import.meta.env.VITE_MONETAG_INPAGE_SCRIPT_URL || "https://nap5k.com/tag.min.js",
  },
  vignette: {
    zoneId: import.meta.env.VITE_MONETAG_VIGNETTE_ZONE_ID || "12054837",
    scriptUrl: import.meta.env.VITE_MONETAG_VIGNETTE_SCRIPT_URL || "https://n6wxm.com/vignette.min.js",
  },
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
