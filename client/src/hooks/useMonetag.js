import { useEffect } from "react";
import { MONETAG_CONFIG } from "../config/ads";

/**
 * Hook to inject Monetag ad scripts conditionally.
 * format: "inpage" (default) or "vignette"
 */
export function useMonetag({ enabled = true, format = "inpage" } = {}) {
  useEffect(() => {
    if (!enabled || !MONETAG_CONFIG.enabled) {
      return;
    }

    const zoneConfig = format === "vignette" ? MONETAG_CONFIG.vignette : MONETAG_CONFIG.inPage;
    const { zoneId, scriptUrl } = zoneConfig;

    if (!zoneId || !scriptUrl) {
      return;
    }

    // Check if script already exists in DOM
    const existing = document.querySelector(`script[data-zone="${zoneId}"]`);
    if (existing) {
      return;
    }

    try {
      const script = document.createElement("script");
      script.dataset.zone = zoneId;
      script.src = scriptUrl;
      script.async = true;

      const target = [document.documentElement, document.body].filter(Boolean).pop();
      if (target) {
        target.appendChild(script);
      }
    } catch (err) {
      console.warn(`[Monetag:${format}] Script injection suppressed:`, err);
    }
  }, [enabled, format]);
}
