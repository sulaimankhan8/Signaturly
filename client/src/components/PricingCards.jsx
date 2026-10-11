import { Link } from "react-router-dom";
import { PRICING_FALLBACK } from "../config/pricingFallback";
import { rupees } from "../utils/checkout";

/**
 * The four plan cards, shown on the landing page and on the pricing page.
 *
 * Prices and document allowances come from `catalogue` (the server's price list) when the page
 * has it, and otherwise from the copy kept with the client. What each plan includes is written
 * here, and must stay true to services/entitlements.service.js on the server.
 */

const Tick = ({ color = "#34d399" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" className="shrink-0 mt-0.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Points = ({ lead, items }) => (
  <ul className="space-y-2.5 text-xs text-gray-200 font-bold">
    {lead && (
      <li className="flex items-start gap-2" style={{ color: lead.color }}>
        <Tick color={lead.color} />
        {lead.text}
      </li>
    )}
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2">
        <Tick />
        {item}
      </li>
    ))}
  </ul>
);

// A price that starts "from" has its word above the figure, and a slightly smaller figure,
// so the figure and its unit stay on one line in a narrow card
const Price = ({ children, unit, from = false }) => (
  <div className="my-5">
    {from && <span className="block text-[10px] text-gray-400 font-black uppercase tracking-wider -mb-1">from</span>}
    <span className="whitespace-nowrap">
      <span className={`${from ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"} font-black text-white font-mono`}>{children}</span>
      <span className="text-xs text-gray-400 font-bold"> {unit}</span>
    </span>
  </div>
);

export default function PricingCards({ catalogue, yearly = false, user = null }) {
  const plans = catalogue?.plans?.length ? catalogue.plans : PRICING_FALLBACK.plans;
  const plan = (id) => plans.find((p) => p.id === id) || PRICING_FALLBACK.plans.find((p) => p.id === id);

  const free = plan("free");
  const pro = plan(yearly ? "pro_annual" : "pro_monthly");
  const business = plan("business_monthly");
  const enterprise = plan("enterprise");

  // Signed in: buying happens where the plan is managed. Not signed in: create an account first.
  const proHref = user ? "/billing" : "/register?next=%2Fbilling";
  const businessHref = user ? "/workspaces" : "/register?next=%2Fworkspaces";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
      {/* 1. Free */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#fff] flex flex-col justify-between" data-testid="plan-free">
        <div>
          <span className="px-2.5 py-1 bg-white/10 text-gray-300 text-[10px] font-black uppercase tracking-wider rounded border border-white/20">Free Forever</span>
          <h3 className="text-xl font-black text-white mt-3 uppercase">{free.name}</h3>
          <Price unit="/ forever">{rupees(0)}</Price>
          <Points
            lead={{ color: "#ffffff", text: `${free.documentsPerMonth} documents a month` }}
            items={["Starter templates, filled in by answering questions", "Draw, type or upload a signature", "Sealed PDF with a signing record", "Signing in English and Hindi"]}
          />
        </div>
        <Link
          to={user ? "/dashboard" : "/register"}
          className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-white/30 transition"
        >
          {user ? "Go to Dashboard" : "Start Free"}
        </Link>
      </div>

      {/* 2. Pro */}
      <div
        className="p-6 sm:p-8 rounded-3xl bg-[#191c2b] border-4 border-yellow-400 shadow-[8px_8px_0px_0px_#ef4444] flex flex-col justify-between relative transform xl:-translate-y-2"
        data-testid="plan-pro"
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded bg-red-600 text-white text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#fff] whitespace-nowrap">
          MOST POPULAR
        </div>
        <div>
          <span className="px-2.5 py-1 bg-yellow-400/20 text-yellow-300 text-[10px] font-black uppercase tracking-wider rounded border border-yellow-400/40">Individual Pro</span>
          <h3 className="text-xl font-black text-white mt-3 uppercase">Pro</h3>
          <Price unit={`/ ${pro.interval === "year" ? "year" : "mo"}`}>{rupees(pro.priceInr)}</Price>
          <Points
            lead={{ color: "#facc15", text: `${pro.documentsPerMonth} documents a month` }}
            items={["Every Pro template pack", "Save your own templates", "Bulk send to 25 people at a time", "No \"Signed with PactDoc\" line on your documents"]}
          />
        </div>
        <Link
          to={proHref}
          className="mt-8 block text-center py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider rounded-xl text-xs border-2 border-black shadow-[4px_4px_0px_0px_#ef4444] transition-all"
        >
          Get Pro →
        </Link>
      </div>

      {/* 3. Business */}
      <div
        className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#151722] via-purple-950/30 to-[#151722] border-2 border-purple-500/50 shadow-[6px_6px_0px_0px_#a855f7] flex flex-col justify-between relative"
        data-testid="plan-business"
      >
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider border border-white/20 whitespace-nowrap">
          FOR TEAMS
        </div>
        <div>
          <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider rounded border border-purple-500/40">Per Seat</span>
          <h3 className="text-xl font-black text-white mt-3 uppercase">{business.name}</h3>
          <Price unit="/ seat / mo">{rupees(business.priceInr)}</Price>
          <Points
            lead={{ color: "#c084fc", text: `${business.documentsPerMonth} documents a seat, shared by the team` }}
            items={["Team workspaces with roles", "Your name and logo for signers", "Contact lists, bulk send to 500", "Two-step sign-in for the team"]}
          />
        </div>
        <Link
          to={businessHref}
          className="mt-8 block text-center py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-black shadow-[2px_2px_0px_0px_#fff] transition-all"
        >
          Get Business →
        </Link>
      </div>

      {/* 4. Enterprise */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#fff] flex flex-col justify-between" data-testid="plan-enterprise">
        <div>
          <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/40">Organizations</span>
          <h3 className="text-xl font-black text-white mt-3 uppercase">{enterprise.name}</h3>
          <Price unit="/ mo" from>
            {rupees(enterprise.priceInr)}
          </Price>
          <Points
            lead={{ color: "#93c5fd", text: "Documents and price agreed with you" }}
            items={["Everything in Business", "API keys and webhooks", "Signing inside your own website", "Single sign-on for your staff"]}
          />
        </div>
        <a
          href="mailto:sales@pactdoc.com"
          className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-white/30 transition"
        >
          Talk to Us
        </a>
      </div>
    </div>
  );
}
