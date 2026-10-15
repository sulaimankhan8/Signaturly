/**
 * Monthly or yearly: the one switch above the plans, on every page that shows them. Drawn like
 * the dashboard's filter tabs. `saving` is what paying by the year saves, in a few words
 * ("2 months free").
 */
export default function PeriodSwitch({ yearly, onChange, saving = "" }) {
  const tab = (on) =>
    `min-h-[40px] px-4 rounded-lg border-2 text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-all ${
      on ? "bg-red-600 text-white border-black shadow-[2px_2px_0px_0px_#facc15]" : "border-transparent text-gray-300 hover:text-white hover:bg-white/10"
    }`;
  return (
    <div className="inline-flex items-center gap-1 p-1.5 rounded-xl bg-[#090a0f] border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]" role="group" aria-label="Billing period">
      <button type="button" onClick={() => onChange(false)} aria-pressed={!yearly} className={tab(!yearly)}>
        Monthly
      </button>
      <button type="button" onClick={() => onChange(true)} aria-pressed={yearly} className={tab(yearly)}>
        Yearly
        {saving && <span className="px-1.5 py-0.5 rounded border-2 border-black bg-yellow-400 text-black text-[10px] font-black">{saving}</span>}
      </button>
    </div>
  );
}
