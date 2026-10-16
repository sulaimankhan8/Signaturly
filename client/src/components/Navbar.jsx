import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { performLogout } from "../store/authActions";
import { UpgradeModal } from "./UpgradeModal";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import BillingAlert from "./BillingAlert";
import BrandGlyph from "./BrandGlyph";
import { useSubscription } from "../hooks/useBillingAccount";
import { billingCtaOf } from "../utils/billing";

// The billing button's look, by what it says (utils/billing.js billingCtaOf)
const CTA_LOOKS = {
  upgrade: "text-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 shadow-[2px_2px_0px_0px_#ef4444] hover:shadow-[3px_3px_0px_0px_#ef4444]",
  documents: "text-black bg-sky-300 hover:bg-sky-200 shadow-[2px_2px_0px_0px_#facc15]",
  fix: "text-white bg-red-600 hover:bg-red-500 shadow-[2px_2px_0px_0px_#facc15]",
};

// The sections of Billing, as the Billing menu lists them. Each chip turns solid on its own page.
const BILLING_LINKS = [
  {
    to: "/billing",
    label: "Overview",
    hint: "Your plan, usage and next payment",
    chip: "bg-red-600/20 border-red-500/40 text-red-400 group-hover:bg-red-600 group-hover:text-white",
    on: "bg-red-600 border-black text-white",
    d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    to: "/billing/plans",
    label: "Plans",
    hint: "Compare plans and upgrade",
    chip: "bg-yellow-400/20 border-yellow-400/40 text-yellow-300 group-hover:bg-yellow-400 group-hover:text-black",
    on: "bg-yellow-400 border-black text-black",
    d: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    to: "/billing/add-ons",
    label: "Extra docs & wallet",
    hint: "One payment, they never expire",
    chip: "bg-blue-600/20 border-blue-500/40 text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
    on: "bg-blue-600 border-black text-white",
    d: "M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    to: "/billing/invoices",
    label: "Invoices",
    hint: "GST invoices and the details on them",
    chip: "bg-emerald-600/20 border-emerald-500/40 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
    on: "bg-emerald-500 border-black text-black",
    d: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  },
];

// The plan and this month's documents, said at the top of the Billing menu
const standingOf = (data) => {
  if (!data) return null;
  const planId = data.entitlements?.plan || data.subscription?.plan;
  const free = (data.entitlements?.tier || "free") === "free";
  const name = data.catalogue?.plans?.find((plan) => plan.id === planId)?.name || data.availablePlans?.[planId]?.name || (free ? "Free" : planId);
  const used = data.usage?.usedThisMonth || 0;
  const quota = data.usage?.monthlyQuota ?? null;
  const extra = data.usage?.extraDocuments || 0;
  return {
    name,
    left: quota === null ? "No monthly limit" : `${Math.max(0, quota - used)} of ${quota} documents left`,
    extra: extra > 0 ? `${extra} extra in hand` : "",
  };
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [activeDropdown, setActiveDropdown] = useState(null); // 'docs' | 'templates' | 'tools' | 'user' | null
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const navRef = useRef(null);
  const subscriptionData = useSubscription();
  const billingCta = billingCtaOf(subscriptionData);
  const standing = standingOf(subscriptionData);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await dispatch(performLogout());
    navigate("/");
  };

  // Helper to check active status
  const isPathActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const isDocsActive =
    isPathActive("/upload") ||
    isPathActive("/editor") ||
    isPathActive("/send") ||
    isPathActive("/assign");

  const isTemplatesActive =
    isPathActive("/templates") || isPathActive("/templates/bulk");

  const isToolsActive =
    isPathActive("/signature-remover") ||
    isPathActive("/workspaces") ||
    isPathActive("/developer") ||
    isPathActive("/verify") ||
    isPathActive("/userguide");

  // Billing's own pages; checkout and the payment screens have a header of their own
  const isBillingActive = isPathActive("/billing");
  const billingSection = (to) => (to === "/billing" ? location.pathname.replace(/\/+$/, "") === "/billing" : isPathActive(to));

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const toggleMobileSection = (name) => {
    setMobileExpandedSection((prev) => (prev === name ? null : name));
  };

  // Zero-layout-shift button class helper with spacious, comfortable dimensions
  const getNavBtnClass = (isActive, dropdownName) => {
    const isDropdownOpen = activeDropdown === dropdownName;
    const base = "px-4 xl:px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-colors duration-150 border-2 flex items-center gap-2 xl:gap-2.5 select-none shrink-0";
    if (isActive) {
      return `${base} bg-red-600 text-white border-black shadow-[2px_2px_0px_0px_#facc15]`;
    }
    if (isDropdownOpen) {
      return `${base} bg-white/10 text-white border-transparent shadow-[2px_2px_0px_0px_transparent]`;
    }
    return `${base} text-gray-300 hover:text-white hover:bg-white/10 border-transparent shadow-[2px_2px_0px_0px_transparent]`;
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 bg-[#090a0f]/95 backdrop-blur-xl border-b-2 border-white/20"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center space-x-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_#ffffff] group-hover:rotate-[-2deg] transition-all">
            <BrandGlyph className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">
              Pact<span className="text-red-500">Doc</span>
            </span>
          </div>
        </div>

        {/* Desktop Center Navigation with Categorized Dropdowns */}
        <nav className="hidden md:flex items-center w-max shrink-0 space-x-1.5 xl:space-x-2.5 bg-[#13151f] p-2 rounded-2xl border-2 border-white/15 shadow-[3px_3px_0px_0px_#000]">
          {/* 1. Dashboard Direct Link */}
          <button
            onClick={() => navigate("/dashboard")}
            className={getNavBtnClass(location.pathname === "/dashboard", "dashboard")}
          >
            <svg
              className="w-4 h-4 text-current shrink-0 hidden xl:block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <span>Dashboard</span>
          </button>

          {/* 2. Documents ▾ Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown("docs")}
              onMouseEnter={() => setActiveDropdown("docs")}
              className={getNavBtnClass(isDocsActive, "docs")}
            >
              <svg
                className="w-4 h-4 shrink-0 hidden xl:block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Documents</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 opacity-80 transition-transform duration-200 ${
                  activeDropdown === "docs" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {activeDropdown === "docs" && (
              <div
                onMouseLeave={() => setActiveDropdown(null)}
                className="absolute top-full left-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
              >
                <button
                  onClick={() => {
                    navigate("/upload");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Upload PDF
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Prepare & sign a new contract
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/dashboard");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 flex items-center justify-center shrink-0 group-hover:bg-yellow-400 group-hover:text-black transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      All Documents Vault
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Manage active & executed files
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 3. Templates ▾ Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown("templates")}
              onMouseEnter={() => setActiveDropdown("templates")}
              className={getNavBtnClass(isTemplatesActive, "templates")}
            >
              <svg
                className="w-4 h-4 shrink-0 hidden xl:block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
              <span>Templates</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 opacity-80 transition-transform duration-200 ${
                  activeDropdown === "templates" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {activeDropdown === "templates" && (
              <div
                onMouseLeave={() => setActiveDropdown(null)}
                className="absolute top-full left-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
              >
                <button
                  onClick={() => {
                    navigate("/templates");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Template Library
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Reusable contract master layouts
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/templates/bulk");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Bulk Send (CSV)
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Mass mailmerge to recipient lists
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/contacts");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m8-5.13a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Contact Lists
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Saved lists, and bulk send with progress
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 4. Tools ▾ Dropdown (Includes Signature Studio, Verify, User Guide, Font Lab) */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown("tools")}
              onMouseEnter={() => setActiveDropdown("tools")}
              className={getNavBtnClass(isToolsActive, "tools")}
            >
              <svg
                className="w-4 h-4 shrink-0 hidden xl:block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Tools</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 opacity-80 transition-transform duration-200 ${
                  activeDropdown === "tools" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {activeDropdown === "tools" && (
              <div
                onMouseLeave={() => setActiveDropdown(null)}
                className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-72 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
              >
                <button
                  onClick={() => {
                    navigate("/signature-remover");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/40 text-pink-400 flex items-center justify-center shrink-0 group-hover:bg-pink-600 group-hover:text-white transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Signature Studio
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      AI background remover &amp; signature pad
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/workspaces");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white block uppercase tracking-wide">
                        Workspaces
                      </span>
                      <span className="text-[8px] font-mono font-black bg-blue-500/30 text-blue-300 px-1.5 py-0.2 rounded">
                        ENTERPRISE
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Team members &amp; white-label branding
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/developer");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white block uppercase tracking-wide">
                        Developer API
                      </span>
                      <span className="text-[8px] font-mono font-black bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded">
                        API KEYS
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      REST API tokens &amp; outgoing webhooks
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/verify");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block uppercase tracking-wide">
                      Verify Document
                    </span>
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      Cryptographic hash &amp; proof validator
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate("/userguide");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all bg-yellow-400/5 border border-yellow-400/20 hover:border-yellow-400/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 flex items-center justify-center shrink-0 group-hover:bg-yellow-400 group-hover:text-black transition-all">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white block uppercase tracking-wide">
                        User Guide
                      </span>
                      <span className="text-[8px] font-mono font-black bg-yellow-400 text-black px-1.5 py-0.2 rounded">
                        NEW
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-300 block leading-tight">
                      Interactive workflows, manuals &amp; FAQs
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 5. Billing ▾ Dropdown (the four sections of Billing, with the plan as it stands) */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown("billing")}
              onMouseEnter={() => setActiveDropdown("billing")}
              className={getNavBtnClass(isBillingActive, "billing")}
            >
              <svg className="w-4 h-4 shrink-0 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Billing</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 opacity-80 transition-transform duration-200 ${
                  activeDropdown === "billing" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {activeDropdown === "billing" && (
              <div
                onMouseLeave={() => setActiveDropdown(null)}
                className="absolute top-full right-0 mt-2 w-72 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
              >
                {standing && (
                  <div className="mb-1.5 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-gray-400">Your plan</span>
                      <span className="block text-xs font-black text-white uppercase truncate">{standing.name}</span>
                    </div>
                    <div className="text-right text-[10px] leading-tight">
                      <span className="block font-bold text-gray-200">{standing.left}</span>
                      {standing.extra && <span className="block text-blue-300">{standing.extra}</span>}
                    </div>
                  </div>
                )}
                {BILLING_LINKS.map((link) => {
                  const here = billingSection(link.to);
                  return (
                    <button
                      key={link.to}
                      onClick={() => {
                        navigate(link.to);
                        setActiveDropdown(null);
                      }}
                      aria-current={here ? "page" : undefined}
                      className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 group transition-all ${here ? "bg-white/10" : "hover:bg-white/10"}`}
                    >
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all ${here ? link.on : link.chip}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.d} />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-black text-white block uppercase tracking-wide">{link.label}</span>
                        <span className="text-[10px] text-gray-400 block leading-tight">{link.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* User Profile & Right Action Area */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* The billing button, for how the account stands; on a phone it is in the menu, where there is room for it */}
          {billingCta && (
            <button
              onClick={() => navigate(billingCta.to)}
              className={`hidden sm:flex px-3.5 py-2 text-xs font-black uppercase tracking-wider border-2 border-black rounded-xl transition-all items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 shrink-0 ${CTA_LOOKS[billingCta.kind]}`}
              title={billingCta.kind === "upgrade" ? "See plans and upgrade" : billingCta.kind === "documents" ? "This month's documents are running out" : "Something about your plan needs you"}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={billingCta.kind === "fix" ? "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" : billingCta.kind === "documents" ? "M12 5v14M5 12h14" : "M13 10V3L4 14h7v7l9-11h-7z"} />
              </svg>
              <span>{billingCta.label}</span>
            </button>
          )}

          {/* User Profile Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown("user")}
              className="flex items-center space-x-2 text-xs font-bold text-gray-200 bg-[#151722] hover:bg-[#1f2233] px-3 py-1.5 rounded-xl border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors shrink-0"
              title="Manage Profile &amp; Settings"
            >
              <div className="w-6 h-6 rounded-lg bg-yellow-400 text-black border border-black flex items-center justify-center text-xs font-black uppercase">
                {(user?.name || user?.email || "U")[0]}
              </div>
              <span className="font-black text-xs max-w-[100px] truncate hidden 2xl:inline">
                {user?.name || user?.email || "Account"}
              </span>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform ${
                  activeDropdown === "user" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {activeDropdown === "user" && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs font-black text-white truncate">
                    {user?.name || "PactDoc User"}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {user?.email || "user@pactdoc.com"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30">
                      PactDoc Account
                    </span>
                    <button
                      onClick={() => {
                        navigate("/billing");
                        setActiveDropdown(null);
                      }}
                      className="text-[10px] text-yellow-400 hover:underline font-bold"
                    >
                      Plans &amp; billing →
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Account settings</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/billing");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-yellow-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span>Plans &amp; billing</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/workspaces");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-blue-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Team Workspaces</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/developer");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-amber-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Developer REST API</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/userguide");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>User Guide &amp; Manual</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:text-white hover:bg-red-600 rounded-xl transition-all flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Shown only to someone in more than one workspace */}
          <WorkspaceSwitcher className="hidden sm:flex" />

          {/* Mobile Drawer Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-gray-300 hover:text-white bg-white/5 border border-white/10"
            aria-label="Toggle Mobile Navigation"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Accordion Style) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0f1118] border-b border-white/10 px-4 py-4 space-y-3 max-h-[85vh] overflow-y-auto">
          {/* User Identity Header */}
          <div
            onClick={() => {
              navigate("/settings");
              setMobileMenuOpen(false);
            }}
            className="flex items-center space-x-3 text-xs text-gray-300 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center text-sm font-bold uppercase">
              {(user?.name || user?.email || "U")[0]}
            </div>
            <div>
              <p className="font-bold text-white text-xs">
                {user?.name || "User Account"}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* The billing button, on a phone */}
          {billingCta && (
            <button
              onClick={() => {
                navigate(billingCta.to);
                setMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 text-xs font-black uppercase tracking-wider border-2 border-black rounded-xl flex items-center justify-center gap-2 ${CTA_LOOKS[billingCta.kind]}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{billingCta.kind === "upgrade" ? "Upgrade your plan" : billingCta.label}</span>
            </button>
          )}

          <div className="space-y-1">
            {/* Dashboard */}
            <button
              onClick={() => {
                navigate("/dashboard");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-2.5 ${
                location.pathname === "/dashboard"
                  ? "bg-red-600 text-white border-2 border-black"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Dashboard</span>
            </button>

            {/* Billing Accordion */}
            <div className={`border rounded-xl overflow-hidden ${isBillingActive ? "border-red-500/60" : "border-white/10"}`}>
              <button
                onClick={() => toggleMobileSection("billing")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase text-yellow-300 bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>Plans &amp; billing</span>
                </div>
                <span className="text-gray-400">{mobileExpandedSection === "billing" ? "−" : "+"}</span>
              </button>
              {mobileExpandedSection === "billing" && (
                <div className="p-2 space-y-1 bg-black/20">
                  {standing && (
                    <p className="px-3 py-1.5 text-[11px] text-gray-400">
                      <span className="font-black uppercase text-white">{standing.name}</span> · {standing.left}
                      {standing.extra ? ` · ${standing.extra}` : ""}
                    </p>
                  )}
                  {BILLING_LINKS.map((link) => (
                    <button
                      key={link.to}
                      onClick={() => {
                        navigate(link.to);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={billingSection(link.to) ? "page" : undefined}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 ${billingSection(link.to) ? "bg-white/10 text-white font-black" : "text-gray-300 hover:text-white hover:bg-white/5"}`}
                    >
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.d} />
                      </svg>
                      <span>{link.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Workspaces */}
            <button
              onClick={() => {
                navigate("/workspaces");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-black uppercase text-blue-300 hover:bg-white/5 rounded-xl transition-all flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Team Workspaces</span>
            </button>

            {/* Developer */}
            <button
              onClick={() => {
                navigate("/developer");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-black uppercase text-amber-300 hover:bg-white/5 rounded-xl transition-all flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Developer REST API</span>
            </button>

            {/* Documents Accordion */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleMobileSection("docs")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase text-gray-200 bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Documents</span>
                </div>
                <span className="text-gray-400">
                  {mobileExpandedSection === "docs" ? "−" : "+"}
                </span>
              </button>
              {mobileExpandedSection === "docs" && (
                <div className="p-2 space-y-1 bg-black/20">
                  <button
                    onClick={() => {
                      navigate("/upload");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Upload PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>All Documents Vault</span>
                  </button>
                </div>
              )}
            </div>

            {/* Templates Accordion */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleMobileSection("templates")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase text-gray-200 bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>Templates &amp; Bulk</span>
                </div>
                <span className="text-gray-400">
                  {mobileExpandedSection === "templates" ? "−" : "+"}
                </span>
              </button>
              {mobileExpandedSection === "templates" && (
                <div className="p-2 space-y-1 bg-black/20">
                  <button
                    onClick={() => {
                      navigate("/templates");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Template Library</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/templates/bulk");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Bulk Send (CSV)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tools Accordion */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleMobileSection("tools")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase text-gray-200 bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Tools &amp; Guide</span>
                </div>
                <span className="text-gray-400">
                  {mobileExpandedSection === "tools" ? "−" : "+"}
                </span>
              </button>
              {mobileExpandedSection === "tools" && (
                <div className="p-2 space-y-1 bg-black/20">
                  <button
                    onClick={() => {
                      navigate("/signature-remover");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Signature Studio</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/verify");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Verify Document</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/userguide");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-yellow-300 hover:text-yellow-200 rounded-lg hover:bg-white/5 font-bold flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Interactive User Guide</span>
                  </button>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => {
                navigate("/settings");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/5 rounded-xl transition-all flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Account settings</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-3 px-4 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      )}

      {/* Global Upgrade Modal Mount */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason="Upgrade your workspace for more documents each month, more template packs and bulk send."
      />

      {/* An overdue payment, or a plan about to end, said under the navbar on every page */}
      <BillingAlert />
    </header>
  );
}
