import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing Plans — Transparent, Scalable E-Signatures",
  description:
    "Choose from Free, Pro, or Enterprise workspace plans. Unlimited envelopes, multi-party routing, and cryptographic audit certificates.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    frequency: "forever",
    description: "For individuals needing occasional, legally binding signatures.",
    features: [
      "5 document executions / month",
      "Standard audit certificate (SHA-256)",
      "Single-signer workflows",
      "Mobile browser signature capture",
      "Email support",
    ],
    cta: "Get Started Free",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    frequency: "per user / month",
    description: "For professionals, freelancers, and growing operations.",
    features: [
      "Unlimited document executions",
      "Multi-party sequential & parallel signing",
      "Reusable legal contract templates",
      "Custom branding & logo placement",
      "Automated signer reminders",
      "Priority customer support",
    ],
    cta: "Upgrade to Pro →",
    href: "/register?plan=pro",
    highlight: true,
  },
  {
    name: "Business",
    price: "$49",
    frequency: "per user / month",
    description: "For legal teams, agencies, and high-volume organizations.",
    features: [
      "Everything in Pro, plus:",
      "Team workspaces & role-based access",
      "Developer API keys & webhooks",
      "Bulk send with CSV signer roster",
      "Custom retention policies",
      "Dedicated account manager",
    ],
    cta: "Start Business Trial →",
    href: "/register?plan=business",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-muted hover:text-white transition-colors"
          >
            ← Back to PactDoc
          </Link>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xs sm:text-sm text-content-muted max-w-xl mx-auto font-medium">
            No surprise overage fees. Scalable plans for freelancers, fast-growing teams, and enterprises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all ${
                plan.highlight
                  ? "bg-surface-elevated border-2 border-crimson shadow-crimson-glow relative"
                  : "bg-surface-card border border-surface-border shadow-elevation-1 hover:border-white/20"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-crimson text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-elevation-1">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase">{plan.name}</h3>
                  <p className="text-xs text-content-muted mt-1">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white font-mono">{plan.price}</span>
                  <span className="text-xs text-content-subtle font-mono">{plan.frequency}</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-surface-border text-xs text-content-secondary">
                  <p className="font-bold uppercase text-[10px] text-content-muted tracking-wider">Included Features:</p>
                  <ul className="space-y-2">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5">
                        <span className="text-crimson font-black">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <Link
                  href={plan.href}
                  className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all block text-center ${
                    plan.highlight
                      ? "bg-crimson hover:bg-crimson-hover text-white shadow-elevation-1"
                      : "bg-surface-card hover:bg-surface-elevated text-content-primary border border-surface-border"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
