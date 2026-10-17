import React, { useEffect, useState } from "react";
import { InHouseAdCard } from "./InHouseAdCard";
import { useMonetag } from "../../hooks/useMonetag";
import { MONETAG_CONFIG, isAdEligibleUser } from "../../config/ads";

export const AdBanner = ({ slotId, format = "auto", responsive = true, compact = false, user = null }) => {
  const isEligible = isAdEligibleUser(user);
  const [adLoaded, setAdLoaded] = useState(false);
  const adsenseClientId = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID;
  const activeSlotId = slotId || import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_ID;

  // Mount Monetag if enabled
  useMonetag({ enabled: isEligible && MONETAG_CONFIG.enabled });

  useEffect(() => {
    if (isEligible && adsenseClientId && !adsenseClientId.includes("XXXX")) {
      try {
        ((window.adsbygoogle = window.adsbygoogle || []).push({}));
        setAdLoaded(true);
      } catch (err) {
        console.warn("[AdBanner] AdSense script failed to push, falling back to In-House Ad:", err);
        setAdLoaded(false);
      }
    }
  }, [adsenseClientId, isEligible]);

  if (!isEligible) {
    return null;
  }

  // If live Google AdSense is active
  if (adsenseClientId && !adsenseClientId.includes("XXXX") && adLoaded) {
    return (
      <div className="my-4 overflow-hidden rounded-xl bg-neutral-950 p-2 text-center border border-neutral-800">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={adsenseClientId}
          data-ad-slot={activeSlotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? "true" : "false"}
        />
      </div>
    );
  }

  // First-Party In-House Card (High-converting PactDoc Pro upsell)
  return (
    <div className="my-4">
      <InHouseAdCard compact={compact} />
    </div>
  );
};

export default AdBanner;
