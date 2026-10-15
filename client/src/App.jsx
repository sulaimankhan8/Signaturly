import { BrowserRouter, Routes, Route } from "react-router-dom";
import { hydrateAuth } from "./store/authActions";
import { lazy, Suspense, useEffect } from "react";
import { useDispatch } from "react-redux";

import TermsConsentModal from "./components/TermsConsentModal";
import OutOfDocumentsPrompt from "./components/OutOfDocumentsPrompt";
import PaymentFlow from "./components/PaymentFlow";

/**
 * Each page is fetched when it is first opened. A signer on a phone downloads the signing page
 * and nothing else: not the dashboard, the editor or the landing page.
 *
 * A page can also be fetched ahead of the first render with `preload()`. It is then drawn at once,
 * with no loading spinner in between, which matters for the public pages that arrive from the
 * server already written out as HTML (see scripts/prerender.mjs).
 */
const page = (loader) => {
  let Loaded = null;
  const Lazy = lazy(loader);
  const Page = (props) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />);
  Page.preload = () =>
    loader().then((module) => {
      Loaded = module.default;
    });
  return Page;
};

const Login = page(() => import("./pages/Login"));
const PaymentReturn = page(() => import("./pages/PaymentReturn"));
const Register = page(() => import("./pages/Register"));
const UploadPdf = page(() => import("./pages/UploadPdf"));
const HomeRedirect = page(() => import("./pages/HomeRedirect"));
const Dashboard = page(() => import("./pages/Dashboard"));
const PdfEditor = page(() => import("./pages/PdfEditor"));
const SendDocument = page(() => import("./pages/SendDocument"));
const AssignFields = page(() => import("./pages/AssignFields"));
const ReviewSend = page(() => import("./pages/ReviewSend"));
const SigningPage = page(() => import("./pages/SigningPage"));
const SignatureRemover = page(() => import("./pages/RemoveBg"));
const Templates = page(() => import("./pages/Templates"));
const TemplateEditor = page(() => import("./pages/TemplateEditor"));
const UseTemplate = page(() => import("./pages/UseTemplate"));
const TemplateFill = page(() => import("./pages/TemplateFill"));
const TemplatePublic = page(() => import("./pages/TemplatePublic"));
const TemplateIndex = page(() => import("./pages/TemplatePublic").then((module) => ({ default: module.TemplateIndex })));
const Settings = page(() => import("./pages/Settings"));
const ForgotPassword = page(() => import("./pages/ForgotPassword"));
const ResetPassword = page(() => import("./pages/ResetPassword"));
const VerifyEmail = page(() => import("./pages/VerifyEmail"));
const BulkSend = page(() => import("./pages/BulkSend"));
const Landing = page(() => import("./pages/Landing"));
const FontTestLab = page(() => import("./pages/FontTestLab"));
const UserGuide = page(() => import("./pages/UserGuide"));
const PublicVerify = page(() => import("./pages/PublicVerify"));
// The public price list, and Billing for a signed-in account: four tabs and the checkout page
const Pricing = page(() => import("./pages/Pricing"));
const BillingLayout = page(() => import("./pages/billing/BillingLayout"));
const BillingOverview = page(() => import("./pages/billing/Overview"));
const BillingPlans = page(() => import("./pages/billing/Plans"));
const BillingAddOns = page(() => import("./pages/billing/AddOns"));
const BillingInvoices = page(() => import("./pages/billing/Invoices"));
const Checkout = page(() => import("./pages/billing/Checkout"));
const TeamWorkspaces = page(() => import("./pages/TeamWorkspaces"));
const ApiSettings = page(() => import("./pages/ApiSettings"));
const InviteAccept = page(() => import("./pages/InviteAccept"));
const ContactLists = page(() => import("./pages/ContactLists"));
const SsoDone = page(() => import("./pages/SsoDone"));
const EsignStandIn = page(() => import("./pages/EsignStandIn"));

// The pages that are served as ready-made HTML
const PRERENDERED = { "/": HomeRedirect, "/pricing": Pricing, "/verify": PublicVerify, "/userguide": UserGuide };

/**
 * Fetches the code of a pre-rendered page before the app starts, so the app can take over the
 * HTML already on screen without blanking it. Resolves at once for every other page.
 */
export const preloadPageFor = (pathname) => {
  const path = pathname.replace(/\/+$/, "") || "/";
  // Template pages: the list at /t and one page per template under it
  const Page = PRERENDERED[path] || (path === "/t" ? TemplateIndex : path.startsWith("/t/") ? TemplatePublic : null);
  return Page ? Page.preload().catch(() => {}) : Promise.resolve();
};

const PageLoading = () => (
  <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
  </div>
);

export default function App() {
  const dispatch = useDispatch();

  // Restore auth state on reload
  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <TermsConsentModal />
      <OutOfDocumentsPrompt />
      <PaymentFlow preload={PaymentReturn.preload} />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Old links (/billing#topups, /billing?plan=...) are sent on to their tab or to checkout by the layout */}
          <Route path="/billing" element={<BillingLayout />}>
            <Route index element={<BillingOverview />} />
            <Route path="plans" element={<BillingPlans />} />
            <Route path="add-ons" element={<BillingAddOns />} />
            <Route path="invoices" element={<BillingInvoices />} />
          </Route>
          <Route path="/billing/checkout" element={<Checkout />} />
          <Route path="/billing/return" element={<PaymentReturn />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspaces" element={<TeamWorkspaces />} />
          <Route path="/developer" element={<ApiSettings />} />
          <Route path="/contacts" element={<ContactLists />} />
          {/* The link in a team invitation email */}
          <Route path="/invite/:token" element={<InviteAccept />} />
          {/* Where an organisation's identity provider sends people back to */}
          <Route path="/sso/done" element={<SsoDone />} />
          {/* Development only: stands in for the Aadhaar eSign provider's page */}
          <Route path="/esign-stand-in/:transactionId" element={<EsignStandIn />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/upload" element={<UploadPdf />} />
          <Route path="/signature-remover" element={<SignatureRemover />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/bulk" element={<BulkSend />} />
          <Route path="/templates/edit/:templateId" element={<TemplateEditor />} />
          <Route path="/templates/use/:templateId" element={<UseTemplate />} />
          <Route path="/templates/fill/:key" element={<TemplateFill />} />
          {/* Public pages for the ready-made templates */}
          <Route path="/t" element={<TemplateIndex />} />
          <Route path="/t/:key" element={<TemplatePublic />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/editor/:pdfId" element={<PdfEditor />} />
          <Route path="/send/:pdfId" element={<SendDocument />} />
          <Route path="/assign/:pdfId" element={<AssignFields />} />
          <Route path="/review/:pdfId" element={<ReviewSend />} />
          <Route path="/sign/:token" element={<SigningPage />} />
          <Route path="/verify" element={<PublicVerify />} />
          {/* Isolated Font Testing Suite (Accessible by direct URL only) */}
          <Route path="/test" element={<FontTestLab />} />
          {/* Comprehensive Interactive User Guide (Accessible at /userguide) */}
          <Route path="/userguide" element={<UserGuide />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
