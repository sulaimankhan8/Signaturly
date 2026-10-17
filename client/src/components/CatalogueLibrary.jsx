import { useNavigate } from "react-router-dom";

const TIER_NAMES = { free: "Free", pro: "Pro", business: "Business", enterprise: "Enterprise" };

// How a template's review status is shown everywhere it appears
export const reviewLine = (reviewer) =>
  reviewer
    ? `Reviewed by ${reviewer.name}, ${new Date(reviewer.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
    : "Not yet reviewed by a lawyer";

/**
 * The ready-made templates, grouped by pack. A template the account's plan does not include is
 * still listed, with the plan that opens it.
 */
export default function CatalogueLibrary({ catalogue, searchQuery = "", onLocked }) {
  const navigate = useNavigate();
  const query = searchQuery.trim().toLowerCase();

  const matches = (template) =>
    !query ||
    [template.title, template.summary, template.packName, template.industry].some((text) => text?.toLowerCase().includes(query));

  const packs = (catalogue?.packs || [])
    .map((pack) => ({ ...pack, templates: (catalogue.templates || []).filter((t) => t.pack === pack.id && matches(t)) }))
    .filter((pack) => pack.templates.length > 0);

  if (!catalogue) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-12 h-12 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="text-center py-16 bg-[#12141c] rounded-2xl border border-white/10 p-8 text-sm text-gray-400">
        No template matches your search.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="bg-[#13151f] border border-white/15 rounded-2xl p-5 text-xs text-gray-300 leading-relaxed">
        <strong className="text-white">Answer a few questions and the document is written for you</strong>, with each signer's
        signature and date already placed. Every template is a starting draft, not legal advice: read it before you send it.
      </div>

      {packs.map((pack) => (
        <section key={pack.id} className="space-y-4" data-testid={`pack-${pack.id}`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">{pack.name}</h2>
              <p className="text-xs text-gray-400">{pack.description}</p>
            </div>
            <span
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                pack.locked ? "bg-yellow-400/10 text-yellow-300 border-yellow-400/40" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              }`}
            >
              {pack.locked ? `${TIER_NAMES[pack.requiredTier]} plan` : "Included in your plan"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pack.templates.map((template) => (
              <article
                key={template.key}
                data-testid={`template-${template.key}`}
                className="bg-[#13151f] border border-white/15 hover:border-red-500/60 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-white">{template.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{template.summary}</p>
                  <p className="text-[11px] text-gray-500">
                    Signed by: {template.signers.join(", ")} · {template.questionCount} questions
                  </p>
                  <p className={`text-[11px] ${template.reviewer ? "text-emerald-400" : "text-amber-400"}`}>{reviewLine(template.reviewer)}</p>
                </div>

                {template.locked ? (
                  <button
                    onClick={() => onLocked?.(template)}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-yellow-300 border border-yellow-400/40 rounded-xl text-xs font-bold"
                  >
                    Available on {TIER_NAMES[template.requiredTier]}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/templates/fill/${template.key}`)}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                  >
                    Use this template
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
