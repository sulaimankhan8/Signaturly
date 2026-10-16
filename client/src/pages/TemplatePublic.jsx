import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import API from "../api/axios";
import { withNext } from "../utils/nextPath";
import BrandGlyph from "../components/BrandGlyph";

/**
 * The public pages for ready-made templates (plan task P4-08): a list at /t and one page per
 * template at /t/<key>. They are written out as HTML when the site is built, so a search engine
 * reads the same content a person sees.
 *
 * The data arrives one of three ways: handed in by the build (`initial`), embedded in the
 * ready-made page as JSON, or fetched from the API when the page is opened inside the app.
 */

const TIER_NAMES = { free: "Free", pro: "Pro", business: "Business", enterprise: "Enterprise" };

const HINT_LABELS = {
  esign_ok: "An ordinary e-signature is usual",
  stamp_duty: "Stamp duty applies",
  aadhaar_advised: "Aadhaar eSign is advised",
  check: "Check what applies before relying on it",
};

const reviewLine = (reviewer) =>
  reviewer
    ? `Reviewed by ${reviewer.name}, ${new Date(reviewer.date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}`
    : "Not yet reviewed by a lawyer";

// Data the build embedded in the page, if this page was served ready-made
const embedded = () => {
  if (typeof document === "undefined") return null;
  try {
    return JSON.parse(document.getElementById("public-template-data")?.textContent || "null");
  } catch {
    return null;
  }
};

const Shell = ({ children }) => (
  <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
    <header className="border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-black text-white">
          <span className="w-8 h-8 grid place-items-center rounded-lg bg-red-600 border-2 border-black" aria-hidden="true">
            <BrandGlyph className="w-6 h-6" />
          </span>
          <span>
            Pact<span className="text-red-500">Doc</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-xs font-bold text-gray-300">
          <Link to="/t" className="hover:text-white">
            Templates
          </Link>
          <Link to="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <Link to="/login" className="hover:text-white">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">{children}</main>
    <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-xs text-gray-500 border-t border-white/10">
      Every template is a starting draft, not legal advice. Read the whole document before you send it.
    </footer>
  </div>
);

export function TemplateIndex({ initial }) {
  const [templates, setTemplates] = useState(() => initial || embedded()?.list || null);

  useEffect(() => {
    if (templates) return;
    API.get("/public/templates")
      .then((res) => setTemplates(res.data.data))
      .catch(() => setTemplates([]));
  }, [templates]);

  const packs = [...new Set((templates || []).map((t) => t.packName))];

  return (
    <Shell>
      <h1 className="text-3xl font-black text-white">Agreement templates you fill in by answering questions</h1>
      <p className="text-sm text-gray-400 mt-3 max-w-2xl leading-relaxed">
        Choose a template, answer a few questions, and the document is written with names, amounts and dates in place and each signer's
        signature already positioned. Send it for e-signature from the same screen.
      </p>

      {!templates && <p className="text-sm text-gray-500 mt-10">Loading templates...</p>}
      {templates?.length === 0 && <p className="text-sm text-gray-400 mt-10">Templates are being reviewed and will appear here soon.</p>}

      {packs.map((pack) => (
        <section key={pack} className="mt-10">
          <h2 className="text-lg font-bold text-white">{pack}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {templates
              .filter((t) => t.packName === pack)
              .map((t) => (
                <li key={t.key} className="bg-[#12141c] border border-white/10 rounded-2xl p-5">
                  <Link to={`/t/${t.key}`} className="text-sm font-bold text-white hover:text-red-400">
                    {t.title}
                  </Link>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{t.summary}</p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {TIER_NAMES[t.requiredTier]} plan{t.requiredTier === "free" ? "" : " and above"} · Signed by {t.signers.join(", ")}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}

export default function TemplatePublic({ initial }) {
  const { key } = useParams();
  const user = useSelector((state) => state.auth.user);
  const [template, setTemplate] = useState(() => {
    const ready = initial || embedded()?.template;
    return ready && ready.key === key ? ready : null;
  });
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (template?.key === key) return;
    setTemplate(null);
    setMissing(false);
    API.get(`/public/templates/${key}`)
      .then((res) => setTemplate(res.data.data))
      .catch(() => setMissing(true));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) {
    return (
      <Shell>
        <h1 className="text-2xl font-black text-white">Template not found</h1>
        <p className="text-sm text-gray-400 mt-3">
          It may have been withdrawn. <Link to="/t" className="text-red-400 underline">See all templates</Link>.
        </p>
      </Shell>
    );
  }

  if (!template) {
    return (
      <Shell>
        <p className="text-sm text-gray-500">Loading...</p>
      </Shell>
    );
  }

  // Signed in: straight to the questions. Not signed in: create an account, then the questions.
  const fillPath = `/templates/fill/${template.key}`;
  const useHref = user ? fillPath : withNext("/register", fillPath);

  return (
    <Shell>
      <p className="text-xs text-gray-500">
        <Link to="/t" className="hover:text-white">
          Templates
        </Link>{" "}
        / {template.packName}
      </p>
      <h1 className="text-3xl font-black text-white mt-2">{template.title}</h1>
      <p className="text-base text-gray-300 mt-3 max-w-2xl leading-relaxed">{template.summary}</p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link to={useHref} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold" data-testid="use-template">
          Use this template
        </Link>
        <span className="text-xs text-gray-400">
          {template.requiredTier === "free" ? "Included in the Free plan" : `Part of the ${TIER_NAMES[template.requiredTier]} plan and above`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white">What you will be asked</h2>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-sm text-gray-300">
            {template.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white">Who signs</h2>
            <p className="text-sm text-gray-300 mt-3">{template.signers.join(" and ")}. Each gets a link by email and signs on their phone or computer.</p>
          </section>

          {template.covers.length > 0 && (
            <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-white">What the document covers</h2>
              <ul className="list-disc pl-5 mt-3 space-y-1.5 text-sm text-gray-300">
                {template.covers.map((heading) => (
                  <li key={heading}>{heading}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="bg-[#12141c] border border-white/10 rounded-2xl p-6 mt-6" data-testid="public-template-notes">
        <h2 className="text-sm font-bold text-white">Before you rely on it</h2>
        <p className="text-sm text-gray-300 mt-3">
          <strong className="text-white">{HINT_LABELS[template.signatureHint?.level] || HINT_LABELS.check}.</strong> {template.signatureHint?.text}
        </p>
        {template.stateNotes.map((note) => (
          <p key={note.state} className="text-sm text-gray-300 mt-2">
            <strong className="text-white">{note.name}:</strong> {note.note}
          </p>
        ))}
        <p className={`text-sm mt-3 ${template.reviewer ? "text-emerald-400" : "text-amber-400"}`}>{reviewLine(template.reviewer)}.</p>
      </section>
    </Shell>
  );
}
