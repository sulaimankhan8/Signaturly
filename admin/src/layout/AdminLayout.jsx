import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { endSession } from "../auth/session.js";
import { Brand, Button } from "../components/ui/basics.jsx";

// Heroicons outline paths, one per section
const ICONS = {
  overview: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  users: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  documents: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  audit: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  payments: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  plans: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",
  subscriptions: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
  enquiries: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  operations: "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085",
  templates: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  activity: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
};

const SECTIONS = [
  { to: "/overview", label: "Overview", icon: "overview" },
  { to: "/users", label: "Users", icon: "users" },
  { to: "/documents", label: "Documents", icon: "documents" },
  { to: "/audit", label: "Audit log", icon: "audit" },
  { to: "/payments", label: "Payments", icon: "payments" },
  { to: "/plans", label: "Plans", icon: "plans" },
  { to: "/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { to: "/enquiries", label: "Enquiries", icon: "enquiries" },
  { to: "/templates", label: "Templates", icon: "templates" },
  { to: "/operations", label: "Operations", icon: "operations" },
  { to: "/activity", label: "Admin activity", icon: "activity" },
];

function Icon({ name }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

function Navigation({ onNavigate }) {
  const admin = useAdmin();
  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Sections">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm border-2 ${
                isActive ? "bg-ink text-surface-page font-bold border-black shadow-hard-sm" : "text-ink-muted font-medium border-transparent hover:text-ink hover:bg-white/5 hover:border-edge"
              }`
            }
          >
            <Icon name={section.icon} />
            {section.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t-2 border-edge">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Signed in as</p>
        <p className="text-sm text-ink truncate mt-1" title={admin.admin.email}>
          {admin.admin.email}
        </p>
        <Button size="sm" onClick={() => endSession("signed_out")} className="w-full mt-3">
          Sign out
        </Button>
      </div>
    </div>
  );
}

/**
 * The frame every screen sits in: the sections down the left on a wide screen, and behind
 * a Menu button on a narrow one.
 */
export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // A new screen starts at its top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 focus:bg-ink focus:text-surface-page focus:px-3 focus:py-2 focus:rounded-lg">
        Skip to the page
      </a>

      {/* Wide screens */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:fixed lg:inset-y-0 bg-surface-panel border-r-2 border-edge">
        <div className="h-16 flex items-center px-4 border-b-2 border-edge">
          <Brand />
        </div>
        <Navigation />
      </aside>

      {/* Narrow screens */}
      <header className="lg:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-4 bg-surface-panel border-b-2 border-edge">
        <Brand />
        <Button onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="menu">
          Menu
        </Button>
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
          <div id="menu" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface-panel border-r-2 border-edge flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b-2 border-edge">
              <Brand />
              <button type="button" onClick={() => setMenuOpen(false)} className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5" aria-label="Close the menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <Navigation onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main id="main" className="flex-1 min-w-0 lg:ml-60">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
