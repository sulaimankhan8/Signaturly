import React from "react";
import { BILLING_LINKS, CTA_LOOKS } from "./navbarData";

export default function NavMobileDrawer({
  user,
  navigate,
  location,
  billingCta,
  isBillingActive,
  billingSection,
  standing,
  mobileExpandedSection,
  toggleMobileSection,
  setMobileMenuOpen,
  handleLogout,
}) {
  return (
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
          <p className="font-bold text-white text-xs">{user?.name || "User Account"}</p>
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
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 ${
                    billingSection(link.to) ? "bg-white/10 text-white font-black" : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
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
            <span className="text-gray-400">{mobileExpandedSection === "docs" ? "−" : "+"}</span>
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
            <span className="text-gray-400">{mobileExpandedSection === "templates" ? "−" : "+"}</span>
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
            <span className="text-gray-400">{mobileExpandedSection === "tools" ? "−" : "+"}</span>
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
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Log Out</span>
      </button>
    </div>
  );
}
