import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { performLogout } from "../store/authActions";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [activeDropdown, setActiveDropdown] = useState(null); // 'docs' | 'templates' | 'tools' | 'user' | null
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState(null);
  const navRef = useRef(null);

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
    isPathActive("/assign") ||
    (location.pathname === "/dashboard" && activeDropdown === "docs");

  const isTemplatesActive =
    isPathActive("/templates") || isPathActive("/templates/bulk");

  const isToolsActive =
    isPathActive("/signature-remover") ||
    isPathActive("/verify") ||
    isPathActive("/userguide");

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const toggleMobileSection = (name) => {
    setMobileExpandedSection((prev) => (prev === name ? null : name));
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 bg-[#090a0f]/95 backdrop-blur-xl border-b-2 border-white/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#ffffff] group-hover:rotate-[-2deg] transition-all">
            <svg
              className="w-6 h-6 text-white"
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
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">
              Signatur<span className="text-red-500">ly</span>
            </span>
            <span className="ml-2 text-[10px] uppercase font-black tracking-widest bg-yellow-400 text-black px-2 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_#ef4444]">
              Pro
            </span>
          </div>
        </div>

        {/* Desktop Center Navigation with Categorized Dropdowns */}
        <nav className="hidden md:flex items-center space-x-1.5 bg-[#151722] p-1.5 rounded-2xl border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
          {/* 1. Dashboard Direct Link */}
          <button
            onClick={() => navigate("/dashboard")}
            className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
              location.pathname === "/dashboard"
                ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                : "text-gray-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <svg
              className="w-3.5 h-3.5 text-current"
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
          <div className="relative">
            <button
              onClick={() => toggleDropdown("docs")}
              onMouseEnter={() => setActiveDropdown("docs")}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
                isDocsActive
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
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
                className={`w-3 h-3 transition-transform duration-200 ${
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
                className="absolute left-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
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
          <div className="relative">
            <button
              onClick={() => toggleDropdown("templates")}
              onMouseEnter={() => setActiveDropdown("templates")}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
                isTemplatesActive
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
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
                className={`w-3 h-3 transition-transform duration-200 ${
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
                className="absolute left-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
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
              </div>
            )}
          </div>

          {/* 4. Tools ▾ Dropdown (Includes Signature Studio, Verify, User Guide, Font Lab) */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("tools")}
              onMouseEnter={() => setActiveDropdown("tools")}
              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
                isToolsActive
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
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
                className={`w-3 h-3 transition-transform duration-200 ${
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
                className="absolute left-0 mt-2 w-72 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1"
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
                      AI background remover & signature pad
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
                      Cryptographic hash & proof validator
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
                      Interactive workflows, manuals & FAQs
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* User Profile & Settings Menu */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <button
              onClick={() => toggleDropdown("user")}
              className="hidden sm:flex items-center space-x-2 text-xs font-bold text-gray-200 bg-[#151722] hover:bg-[#1f2233] px-3 py-1.5 rounded-xl border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors"
              title="Manage Profile & Settings"
            >
              <div className="w-6 h-6 rounded-lg bg-yellow-400 text-black border border-black flex items-center justify-center text-xs font-black uppercase">
                {(user?.name || user?.email || "U")[0]}
              </div>
              <span className="font-black text-xs max-w-[120px] truncate">
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
              <div className="absolute right-0 mt-2 w-64 bg-[#12141e] border-2 border-white/20 rounded-2xl shadow-[5px_5px_0px_0px_#000] p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs font-black text-white truncate">
                    {user?.name || "Signaturly User"}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {user?.email || "user@signaturly.pro"}
                  </p>
                  <span className="mt-1.5 inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30">
                    Pro Verified Plan
                  </span>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/userguide");
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-yellow-400"
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
                    <span>User Guide & Manual</span>
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

          {/* Quick Sign Out (Desktop) */}
          <button
            onClick={handleLogout}
            className="hidden sm:flex px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 border-2 border-black shadow-[2px_2px_0px_0px_#ffffff] hover:shadow-[3px_3px_0px_0px_#ffffff] rounded-xl transition-all items-center gap-1.5"
            title="Sign Out"
          >
            <svg
              className="w-4 h-4 text-white"
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
            <span>Logout</span>
          </button>

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

          <div className="space-y-1">
            {/* Dashboard */}
            <button
              onClick={() => {
                navigate("/dashboard");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase rounded-xl transition-all ${
                location.pathname === "/dashboard"
                  ? "bg-red-600 text-white border-2 border-black"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              📊 Dashboard
            </button>

            {/* Documents Accordion */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleMobileSection("docs")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase text-gray-200 bg-white/5"
              >
                <span>📁 Documents</span>
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
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    📄 Upload PDF
                  </button>
                  <button
                    onClick={() => {
                      navigate("/dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    📑 All Documents Vault
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
                <span>📑 Templates & Bulk</span>
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
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    📚 Template Library
                  </button>
                  <button
                    onClick={() => {
                      navigate("/templates/bulk");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    📬 Bulk Send (CSV)
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
                <span>🛠️ Tools & Guide</span>
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
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    ✍️ Signature Studio
                  </button>
                  <button
                    onClick={() => {
                      navigate("/verify");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    🛡️ Verify Document
                  </button>
                  <button
                    onClick={() => {
                      navigate("/userguide");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-yellow-300 hover:text-yellow-200 rounded-lg hover:bg-white/5 font-bold"
                  >
                    📘 Interactive User Guide
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
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/5 rounded-xl transition-all"
            >
              ⚙️ Account Settings
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-3 px-4 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center justify-center gap-2"
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
    </header>
  );
}
