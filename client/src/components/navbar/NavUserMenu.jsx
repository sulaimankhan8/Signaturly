import React from "react";
import WorkspaceSwitcher from "../WorkspaceSwitcher";
import { CTA_LOOKS } from "./navbarData";

export default function NavUserMenu({
  user,
  navigate,
  billingCta,
  activeDropdown,
  toggleDropdown,
  setActiveDropdown,
  handleLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
}) {
  return (
    <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
      {/* The billing button, for how the account stands */}
      {billingCta && (
        <button
          onClick={() => navigate(billingCta.to)}
          className={`hidden sm:flex px-3.5 py-2 text-xs font-black uppercase tracking-wider border-2 border-black rounded-xl transition-all items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 shrink-0 ${CTA_LOOKS[billingCta.kind]}`}
          title={
            billingCta.kind === "upgrade"
              ? "See plans and upgrade"
              : billingCta.kind === "documents"
              ? "This month's documents are running out"
              : "Something about your plan needs you"
          }
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d={
                billingCta.kind === "fix"
                  ? "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
                  : billingCta.kind === "documents"
                  ? "M12 5v14M5 12h14"
                  : "M13 10V3L4 14h7v7l9-11h-7z"
              }
            />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Profile Dropdown Menu */}
        {activeDropdown === "user" && (
          <div
            onMouseLeave={() => setActiveDropdown(null)}
            className="absolute top-full right-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2"
          >
            <div className="p-2 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs font-black text-white truncate">{user?.name || "PactDoc User"}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email || "user@pactdoc.com"}</p>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  );
}
