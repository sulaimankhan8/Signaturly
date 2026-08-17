import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { performLogout } from "../store/authActions";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await dispatch(performLogout());
    navigate("/");
  };


  const navLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Upload PDF", path: "/upload" },
    { label: "Templates", path: "/templates" },
    { label: "Bulk Send", path: "/templates/bulk" },
    { label: "Signature Studio", path: "/signature-remover" },
    { label: "Settings", path: "/settings" },
  ];


  return (
    <header className="sticky top-0 z-50 bg-[#090a0f]/95 backdrop-blur-xl border-b-2 border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_#ffffff] group-hover:rotate-[-2deg] transition-all">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

        {/* Desktop Center Links */}
        <nav className="hidden md:flex items-center space-x-1.5 bg-[#151722] p-1.5 rounded-2xl border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  isActive
                    ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* User & Logout & Mobile Drawer Toggle */}
        <div className="flex items-center space-x-3">
          <div
            onClick={() => navigate("/settings")}
            className="hidden sm:flex items-center space-x-2 text-xs font-bold text-gray-200 bg-[#151722] hover:bg-[#1f2233] px-3 py-1.5 rounded-xl border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors"
            title="Manage Profile & Settings"
          >
            <div className="w-6 h-6 rounded-lg bg-yellow-400 text-black border border-black flex items-center justify-center text-xs font-black uppercase">
              {(user?.name || user?.email || "U")[0]}
            </div>
            <span className="font-black text-xs max-w-[120px] truncate">{user?.name || user?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="hidden sm:flex px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 border-2 border-black shadow-[2px_2px_0px_0px_#ffffff] hover:shadow-[3px_3px_0px_0px_#ffffff] rounded-xl transition-all items-center gap-1.5"
            title="Sign Out"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>


          {/* Mobile Drawer Button */}
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
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0f1118] border-b border-white/10 px-4 py-4 space-y-3">
          <div
            onClick={() => {
              navigate("/settings");
              setMobileMenuOpen(false);
            }}
            className="flex items-center space-x-2 text-xs text-gray-300 bg-white/5 p-3 rounded-xl border border-white/10 mb-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center text-sm font-bold uppercase">
              {(user?.name || user?.email || "U")[0]}
            </div>
            <div>
              <p className="font-bold text-white text-xs">{user?.name || "User Account"}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-xs font-bold rounded-xl transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-red-600 to-red-800 text-white border border-red-500/30"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-2 px-4 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      )}
    </header>
  );
}
