import React, { useState } from "react";
import { HOUSE_ADS } from "../../config/houseAds.config";

export const InHouseAdCard = ({ adId, compact = false, onAction }) => {
  const [currentIndex, setCurrentIndex] = useState(
    adId ? Math.max(0, HOUSE_ADS.findIndex((a) => a.id === adId)) : 0
  );

  const ad = HOUSE_ADS[currentIndex] || HOUSE_ADS[0];

  const themeStyles = {
    purple: {
      border: "border-purple-500/30",
      bg: "bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-neutral-900",
      badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      btn: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25",
    },
    blue: {
      border: "border-blue-500/30",
      bg: "bg-gradient-to-br from-blue-950/40 via-blue-900/20 to-neutral-900",
      badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      btn: "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-500/25",
    },
    emerald: {
      border: "border-emerald-500/30",
      bg: "bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-neutral-900",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      btn: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25",
    },
  }[ad.theme || "purple"];

  const handleClick = (e) => {
    if (onAction) {
      e.preventDefault();
      onAction(ad);
    }
  };

  if (compact) {
    return (
      <div className={`p-4 rounded-xl border ${themeStyles.border} ${themeStyles.bg} shadow-lg transition-all`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{ad.icon}</span>
            <div>
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${themeStyles.badge}`}>
                {ad.badge}
              </span>
              <h4 className="text-sm font-semibold text-white mt-0.5">{ad.title}</h4>
            </div>
          </div>
          <a
            href={ad.targetUrl}
            target={ad.isInternal ? "_self" : "_blank"}
            rel="noreferrer"
            onClick={handleClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md ${themeStyles.btn} whitespace-nowrap transition-all`}
          >
            {ad.cta}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-2xl border ${themeStyles.border} ${themeStyles.bg} shadow-xl backdrop-blur-md relative overflow-hidden transition-all`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${themeStyles.badge}`}>
          <span>{ad.icon}</span> {ad.badge}
        </span>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Sponsored</span>
      </div>

      <h3 className="text-lg font-bold text-white mt-3 leading-snug">{ad.title}</h3>
      <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">{ad.subtitle}</p>

      <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={() => setCurrentIndex((prev) => (prev + 1) % HOUSE_ADS.length)}
          className="text-[11px] text-neutral-400 hover:text-white transition-colors"
        >
          Next Offer ↻
        </button>
        <a
          href={ad.targetUrl}
          target={ad.isInternal ? "_self" : "_blank"}
          rel="noreferrer"
          onClick={handleClick}
          className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg ${themeStyles.btn} transition-all transform hover:-translate-y-0.5`}
        >
          {ad.cta}
        </a>
      </div>
    </div>
  );
};
