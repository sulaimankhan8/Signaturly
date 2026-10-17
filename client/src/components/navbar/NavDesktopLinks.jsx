import React from "react";
import { BILLING_LINKS } from "./navbarData";

export default function NavDesktopLinks({
  location,
  navigate,
  activeDropdown,
  setActiveDropdown,
  toggleDropdown,
  getNavBtnClass,
  isDocsActive,
  isTemplatesActive,
  isToolsActive,
  isBillingActive,
  billingSection,
  standing,
}) {
  return (
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Upload PDF
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Prepare &amp; sign a new contract
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  All Documents Vault
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Track status, signers, &amp; logs
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
            className="absolute top-full left-0 mt-2 w-72 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
          >
            <button
              onClick={() => {
                navigate("/templates");
                setActiveDropdown(null);
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Template Library
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Prebuilt NDAs, Offers, &amp; Leases
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Bulk Send via CSV
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Dispatch batch contracts to hundreds
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 4. Tools ▾ Dropdown */}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
            className="absolute top-full left-0 mt-2 w-72 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
          >
            <button
              onClick={() => {
                navigate("/signature-remover");
                setActiveDropdown(null);
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-600/20 border border-pink-500/40 text-pink-400 flex items-center justify-center shrink-0 group-hover:bg-pink-600 group-hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Signature Studio
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Background eraser &amp; transparent seal
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
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Team Workspaces
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Multi-seat teams &amp; member permissions
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Developer REST API
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  API keys, webhooks, &amp; embed links
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-white block uppercase tracking-wide">
                  Verify Document
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Audit SHA-256 integrity seal
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                navigate("/userguide");
                setActiveDropdown(null);
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-start gap-3 group transition-all border-t border-white/10 mt-1"
            >
              <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 flex items-center justify-center shrink-0 group-hover:bg-yellow-400 group-hover:text-black transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-yellow-300 block uppercase tracking-wide">
                  Interactive User Guide
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  Step-by-step video &amp; screenshots
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 5. Plans & Billing ▾ Dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => toggleDropdown("billing")}
          onMouseEnter={() => setActiveDropdown("billing")}
          className={getNavBtnClass(isBillingActive, "billing")}
          aria-haspopup="menu"
          aria-expanded={activeDropdown === "billing"}
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
            className="absolute top-full left-0 mt-2 w-80 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2"
          >
            {standing && (
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block">Current plan</span>
                  <p className="text-xs font-black text-white uppercase truncate">{standing.name}</p>
                  <p className="text-[11px] text-yellow-300 font-bold truncate">
                    {standing.left}
                    {standing.extra ? <span className="text-gray-400"> · {standing.extra}</span> : null}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigate("/billing/plans");
                    setActiveDropdown(null);
                  }}
                  className="px-3 py-1.5 text-[11px] font-black uppercase rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 shrink-0"
                >
                  Change
                </button>
              </div>
            )}

            <div className="space-y-1">
              {BILLING_LINKS.map((link) => {
                const here = billingSection(link.to);
                return (
                  <button
                    key={link.to}
                    onClick={() => {
                      navigate(link.to);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 group transition-all ${
                      here ? "bg-white/10" : "hover:bg-white/10"
                    }`}
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
          </div>
        )}
      </div>
    </nav>
  );
}
