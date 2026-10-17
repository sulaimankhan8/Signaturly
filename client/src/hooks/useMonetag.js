import { useEffect } from "react";
import { MONETAG_CONFIG } from "../config/ads";

/**
 * Hook to inject Monetag In-Page Push script conditionally.
 * Only fires when enabled === true, and ensures no duplicate scripts are mounted.
 */
export function useMonetag({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || !MONETAG_CONFIG.enabled || !MONETAG_CONFIG.zoneId) {
      return;
    }

    // Check if script already exists in DOM
    const existing = document.querySelector(`script[data-zone="${MONETAG_CONFIG.zoneId}"]`);
    if (existing) {
      return;
    }

    try {
      const script = document.createElement("script");
      script.dataset.zone = MONETAG_CONFIG.zoneId;
      script.src = MONETAG_CONFIG.scriptUrl;
      script.async = true;

      const target = [document.documentElement, document.body].filter(Boolean).pop();
      if (target) {
        target.appendChild(script);
      }
    } catch (err) {
      console.warn("[Monetag] Script injection suppressed or failed:", err);
    }
  }, [enabled]);
}
