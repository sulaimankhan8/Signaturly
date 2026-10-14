/**
 * Monthly or yearly: the one switch above the plans, on every page that shows them.
 * `saving` is what paying by the year saves, in a few words ("2 months free").
 */
export default function PeriodSwitch({ yearly, onChange, saving = "" }) {
  const tab = (on) => `min-h-[40px] px-[18px] rounded-[9px] text-sm font-bold inline-flex items-center gap-2 transition-colors ${on ? "bg-rose-600 text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#12141c] border border-white/10" role="group" aria-label="Billing period">
      <button type="button" onClick={() => onChange(false)} aria-pressed={!yearly} className={tab(!yearly)}>
        Monthly
      </button>
      <button type="button" onClick={() => onChange(true)} aria-pressed={yearly} className={tab(yearly)}>
        Yearly
        {saving && <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#1a1405] text-[11px] font-bold">{saving}</span>}
      </button>
    </div>
  );
}
