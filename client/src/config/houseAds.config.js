/**
 * Central In-House House Ads Catalog
 * 100% AdBlock-Immune First-Party Banners
 * Used as fallback when external Google Ad scripts are absent/blocked
 */
export const HOUSE_ADS = [
  {
    id: "signaturly-pro-ltd",
    badge: "Special Founder Deal",
    title: "⚡ Get Unlimited Signatures Forever",
    subtitle: "Upgrade to Signaturly Pro Lifetime Pass ($69). Never see ads, enjoy custom branding and unlimited envelopes.",
    cta: "Claim Lifetime Deal ($69) →",
    targetUrl: "/settings?tab=billing",
    isInternal: true,
    theme: "purple",
    icon: "⚡",
  },
  {
    id: "sister-app-suite",
    badge: "Featured Ecosystem Tool",
    title: "🚀 Supercharge Your Digital Workflow",
    subtitle: "Discover high-performance automation and document intelligence tools tailored for modern teams.",
    cta: "Explore Apps →",
    targetUrl: "https://github.com/sulaimankhan8",
    isInternal: false,
    theme: "blue",
    icon: "🛠️",
  },
  {
    id: "signaturly-pro-annual",
    badge: "Save 32% Today",
    title: "💼 Professional E-Signatures for Teams",
    subtitle: "Switch to Pro Creator for $49/year. Includes CSV bulk send, reusable legal templates, and priority support.",
    cta: "Upgrade to Pro →",
    targetUrl: "/settings?tab=billing",
    isInternal: true,
    theme: "emerald",
    icon: "📄",
  },
];
