/**
 * Monthly or yearly: the one switch above the plans, on every page that shows them.
 * `saving` is what paying by the year saves, in a few words ("2 months free").
 */
export default function PeriodSwitch({ yearly, onChange, saving = "" }) {
  const tab = (on) => `px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${on ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="bg-[#12141c] p-0.5 rounded-xl border-2 border-white/15 inline-flex items-center" role="group" aria-label="Billing period">
      <button type="button" onClick={() => onChange(false)} aria-pressed={!yearly} className={tab(!yearly)}>
        Monthly
      </button>
      <button type="button" onClick={() => onChange(true)} aria-pressed={yearly} className={`${tab(yearly)} flex items-center gap-1.5`}>
        Yearly
        {saving && <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-px rounded font-black border border-black">{saving}</span>}
      </button>
    </div>
  );
}
