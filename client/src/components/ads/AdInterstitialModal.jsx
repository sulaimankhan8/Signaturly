import React, { useState, useEffect } from "react";
import { InHouseAdCard } from "./InHouseAdCard";

export const AdInterstitialModal = ({ documentName, onProceed, show = true }) => {
  const [countdown, setCountdown] = useState(10);
  const [canProceed, setCanProceed] = useState(false);
  const [isOpen, setIsOpen] = useState(show);

  useEffect(() => {
    // Check if user already saw the ad in this session
    const viewed = sessionStorage.getItem("sig_ad_viewed");
    if (viewed === "true") {
      setIsOpen(false);
      if (onProceed) onProceed();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onProceed]);

  const handleProceed = () => {
    sessionStorage.setItem("sig_ad_viewed", "true");
    setIsOpen(false);
    if (onProceed) onProceed();
  };

  if (!isOpen) return null;

  const progressPercent = ((10 - countdown) / 10) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
              Secure Document Gateway
            </span>
          </div>
          <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-neutral-700">
            Free Tier Sponsor Gate
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-base font-bold text-white leading-tight">
            Preparing Document Access
          </h2>
          <p className="text-xs text-neutral-400 mt-1 truncate">
            {documentName || "Legally Binding Agreement"}
          </p>
        </div>

        {/* Sponsor Card (Google AdSense Slot or In-House Fallback) */}
        <div className="my-1">
          <InHouseAdCard />
        </div>

        {/* Countdown & Action */}
        <div className="flex flex-col gap-3 pt-2">
          {/* Progress Bar */}
          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>
              {canProceed
                ? "✓ Document unlocked and ready."
                : `Document access unlocks in: 00:0${countdown}s`}
            </span>
            <span className="font-mono text-emerald-400">{Math.round(progressPercent)}%</span>
          </div>

          <button
            type="button"
            disabled={!canProceed}
            onClick={handleProceed}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              canProceed
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer transform hover:-translate-y-0.5"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
            }`}
          >
            {canProceed ? (
              <>
                <span>Proceed to Review & Sign</span>
                <span>➔</span>
              </>
            ) : (
              <span>Please wait {countdown}s...</span>
            )}
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-neutral-500">
          💡 Sender can upgrade to{" "}
          <span className="text-purple-400 font-semibold">Signaturly Pro</span> to remove sponsor gates for all recipients.
        </p>
      </div>
    </div>
  );
};
