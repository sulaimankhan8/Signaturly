import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { endSession } from "../auth/session.js";
import { Brand, Button, Icon } from "../components/ui/basics.jsx";
import { ICONS } from "../components/ui/icons.js";

// The sections, in the groups the sidebar shows them in
const GROUPS = [
  { label: "Insights", sections: [{ to: "/overview", label: "Overview", icon: "overview" }] },
  {
    label: "Customers",
    sections: [
      { to: "/users", label: "Users", icon: "users" },
      { to: "/subscriptions", label: "Subscriptions", icon: "subscriptions" },
      { to: "/enquiries", label: "Enquiries", icon: "enquiries" },
    ],
  },
  {
    label: "Documents",
    sections: [
      { to: "/documents", label: "Documents", icon: "documents" },
      { to: "/templates", label: "Templates", icon: "templates" },
      { to: "/audit", label: "Audit log", icon: "audit" },
    ],
  },
  {
    label: "Revenue",
    sections: [
      { to: "/payments", label: "Payments", icon: "payments" },
      { to: "/plans", label: "Plans", icon: "plans" },
    ],
  },
  {
    label: "System",
    sections: [
      { to: "/operations", label: "Operations", icon: "operations" },
      { to: "/activity", label: "Admin activity", icon: "activity" },
    ],
  },
];

// The section a path belongs to, with its group: /users/123 is in Users
const sectionOf = (pathname) => {
  for (const group of GROUPS) {
    const section = group.sections.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`));
    if (section) return { group: group.label, ...section };
  }
  return null;
};

const initialsOf = (admin) =>
  (admin.name || admin.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

// Whether the wide sidebar is folded down to its icons, remembered in this browser
const FOLDED_KEY = "pactdoc_admin_sidebar_folded";
const readFolded = () => {
  try {
    return localStorage.getItem(FOLDED_KEY) === "1";
  } catch {
    return false;
  }
};

function Navigation({ onNavigate, folded = false }) {
  const { admin } = useAdmin();
  const [find, setFind] = useState("");
  const groups = useMemo(() => {
    const needle = find.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((group) => ({ ...group, sections: group.sections.filter((s) => s.label.toLowerCase().includes(needle)) })).filter((group) => group.sections.length);
  }, [find]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!folded && (
        <div className="px-4 pt-4">
          <label className="relative block">
            <span className="sr-only">Find a section</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Icon d={ICONS.search} className="w-4 h-4" />
            </span>
            <input
              type="search"
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Search…"
              className="h-10 w-full rounded-xl bg-white/[0.03] border border-edge pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60 focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
          </label>
        </div>
      )}

      <nav className={`flex-1 overflow-y-auto ${folded ? "px-3" : "px-4"} py-4 space-y-5`} aria-label="Sections">
        {groups.map((group) => (
          <div key={group.label}>
            {folded ? (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.sections.map((section) => (
                <NavLink
                  key={section.to}
                  to={section.to}
                  onClick={onNavigate}
                  title={folded ? section.label : undefined}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-xl ${folded ? "justify-center h-10" : "px-3 py-2.5"} text-sm transition ${
                      isActive
                        ? "bg-gradient-to-r from-accent/20 via-accent/[0.07] to-transparent text-white font-bold before:absolute before:left-0 before:inset-y-2 before:w-[3px] before:rounded-full before:bg-accent"
                        : "text-ink-muted font-medium hover:text-ink hover:bg-white/[0.04]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={isActive ? "text-accent" : ""}>
                        <Icon d={ICONS[section.icon]} />
                      </span>
                      {folded ? <span className="sr-only">{section.label}</span> : section.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="px-3 text-sm text-ink-faint">No section is called that.</p>}
      </nav>

      <div className={`border-t border-line ${folded ? "p-3" : "p-4"}`}>
        <div className={`flex items-center gap-3 ${folded ? "flex-col" : ""}`}>
          <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-accent text-xs font-bold text-white ring-2 ring-white/10" aria-hidden="true">
            {initialsOf(admin)}
          </span>
          {!folded && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Signed in as</p>
              <p className="text-sm text-ink truncate" title={admin.email}>
                {admin.email}
              </p>
            </div>
          )}
          <button type="button" onClick={() => endSession("signed_out")} className="grid place-items-center h-9 w-9 shrink-0 rounded-lg text-ink-muted hover:text-white hover:bg-accent/15" title="Sign out">
            <Icon d={ICONS.signOut} className="w-[18px] h-[18px]" />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const clock = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

// The bar across the top of a wide screen: where you are, and the time it is in India
function TopBar() {
  const location = useLocation();
  const { admin } = useAdmin();
  const section = sectionOf(location.pathname);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden lg:flex sticky top-0 z-20 h-[72px] items-center justify-between gap-4 px-8 bg-surface-page/80 backdrop-blur border-b border-line">
      <div className="min-w-0">
        <p className="font-display text-[15px] font-bold text-ink truncate">
          {section ? (
            <>
              <span className="text-ink-faint font-medium">{section.group} / </span>
              {section.label}
            </>
          ) : (
            "PactDoc admin"
          )}
        </p>
        <p className="text-xs text-ink-faint truncate">Welcome back, {admin.name || admin.email}</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-white/[0.03] px-3 py-1.5 text-xs text-ink-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" aria-hidden="true" />
        <span className="tabular-nums">{clock.format(now)} IST</span>
      </span>
    </div>
  );
}

/**
 * The frame every screen sits in: the sections down the left on a wide screen (folded to
 * their icons if you like), and behind a Menu button on a narrow one.
 */
export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [folded, setFolded] = useState(readFolded);
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

  const fold = () => {
    const next = !folded;
    setFolded(next);
    try {
      localStorage.setItem(FOLDED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; it still folds
    }
  };

  return (
    <div className="min-h-screen lg:flex bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(239,43,74,0.06),transparent_60%),radial-gradient(900px_500px_at_100%_0%,rgba(57,135,229,0.05),transparent_60%)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 focus:bg-accent focus:text-white focus:px-3 focus:py-2 focus:rounded-lg">
        Skip to the page
      </a>

      {/* Wide screens */}
      <aside className={`hidden lg:flex lg:flex-col ${folded ? "lg:w-[76px]" : "lg:w-64"} lg:shrink-0 lg:fixed lg:inset-y-0 z-30 bg-surface-panel border-r border-line transition-[width] duration-200`}>
        <div className={`relative h-[72px] shrink-0 flex items-center ${folded ? "justify-center" : "px-5"} border-b border-line`}>
          {folded ? (
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-accent-hover to-accent-deep text-white font-display font-bold shadow-accent" aria-label="PactDoc admin">
              P
            </span>
          ) : (
            <Brand />
          )}
          <button
            type="button"
            onClick={fold}
            aria-pressed={folded}
            title={folded ? "Open the sidebar" : "Fold the sidebar"}
            className="absolute -right-3.5 top-[86px] z-10 grid place-items-center w-7 h-7 rounded-full bg-surface-raised border border-edge text-ink-muted hover:text-ink shadow-soft"
          >
            <span className={`transition-transform ${folded ? "rotate-180" : ""}`}>
              <Icon d={ICONS.collapse} className="w-3.5 h-3.5" />
            </span>
            <span className="sr-only">{folded ? "Open the sidebar" : "Fold the sidebar"}</span>
          </button>
        </div>
        <Navigation folded={folded} />
      </aside>

      {/* Narrow screens */}
      <header className="lg:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-4 bg-surface-panel/95 backdrop-blur border-b border-line">
        <Brand />
        <Button onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="menu">
          <Icon d={ICONS.menu} className="w-4 h-4" />
          Menu
        </Button>
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
          <div id="menu" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface-panel border-r border-line flex flex-col">
            <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-line">
              <Brand />
              <button type="button" onClick={() => setMenuOpen(false)} className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5" aria-label="Close the menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <Navigation onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main id="main" className={`flex-1 min-w-0 ${folded ? "lg:ml-[76px]" : "lg:ml-64"} transition-[margin] duration-200`}>
        <TopBar />
        <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
