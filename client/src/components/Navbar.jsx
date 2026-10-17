import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { performLogout } from "../store/authActions";
import { UpgradeModal } from "./UpgradeModal";
import BillingAlert from "./BillingAlert";
import BrandGlyph from "./BrandGlyph";
import { useSubscription } from "../hooks/useBillingAccount";
import { billingCtaOf } from "../utils/billing";
import { standingOf } from "./navbar/navbarData";
import NavDesktopLinks from "./navbar/NavDesktopLinks";
import NavUserMenu from "./navbar/NavUserMenu";
import NavMobileDrawer from "./navbar/NavMobileDrawer";

/**
 * Navbar Conductor Component
 * Decomposed into modular sub-components:
 * - NavDesktopLinks: Categorized desktop dropdowns
 * - NavUserMenu: User avatar, billing CTA, and workspace switchers
 * - NavMobileDrawer: Responsive mobile slideout menu
 */
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [activeDropdown, setActiveDropdown] = useState(null); // 'docs' | 'templates' | 'tools' | 'billing' | 'user' | null
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

  const isBillingActive = isPathActive("/billing");
  const billingSection = (to) =>
    to === "/billing" ? location.pathname.replace(/\/+$/, "") === "/billing" : isPathActive(to);

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const toggleMobileSection = (name) => {
    setMobileExpandedSection((prev) => (prev === name ? null : name));
  };

  // Zero-layout-shift button class helper with spacious, comfortable dimensions
  const getNavBtnClass = (isActive, dropdownName) => {
    const isDropdownOpen = activeDropdown === dropdownName;
    const base =
      "px-4 xl:px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-colors duration-150 border-2 flex items-center gap-2 xl:gap-2.5 select-none shrink-0";
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
        <NavDesktopLinks
          location={location}
          navigate={navigate}
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown}
          toggleDropdown={toggleDropdown}
          getNavBtnClass={getNavBtnClass}
          isDocsActive={isDocsActive}
          isTemplatesActive={isTemplatesActive}
          isToolsActive={isToolsActive}
          isBillingActive={isBillingActive}
          billingSection={billingSection}
          standing={standing}
        />

        {/* User Profile & Right Action Area */}
        <NavUserMenu
          user={user}
          navigate={navigate}
          billingCta={billingCta}
          activeDropdown={activeDropdown}
          toggleDropdown={toggleDropdown}
          setActiveDropdown={setActiveDropdown}
          handleLogout={handleLogout}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      </div>

      {/* Mobile Drawer Navigation (Accordion Style) */}
      {mobileMenuOpen && (
        <NavMobileDrawer
          user={user}
          navigate={navigate}
          location={location}
          billingCta={billingCta}
          isBillingActive={isBillingActive}
          billingSection={billingSection}
          standing={standing}
          mobileExpandedSection={mobileExpandedSection}
          toggleMobileSection={toggleMobileSection}
          setMobileMenuOpen={setMobileMenuOpen}
          handleLogout={handleLogout}
        />
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
