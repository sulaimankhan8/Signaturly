import { useCallback, useEffect, useState } from "react";
import { fetchSavedSignatureApi, saveSignatureApi, deleteSavedSignatureApi } from "../../api/user.api";

/**
 * The signature and initials saved with the signed-in user's account.
 *
 * Returns { signature, initials, loading, save(kind, dataUrl) }; saving "" removes it. The image
 * is used at once, so a failed save to the account (offline, say) does not lose it for the
 * document being signed now.
 */
export function useSavedSignature({ enabled = true } = {}) {
  const [images, setImages] = useState({ signature: "", initials: "" });
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    fetchSavedSignatureApi()
      .then((saved) => current && setImages({ signature: saved?.signature || "", initials: saved?.initials || "" }))
      .catch(() => {})
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [enabled]);

  const save = useCallback(async (kind, dataUrl) => {
    setImages((previous) => ({ ...previous, [kind]: dataUrl }));
    if (!["signature", "initials"].includes(kind)) return;
    if (dataUrl) await saveSignatureApi(kind, dataUrl);
    else await deleteSavedSignatureApi(kind);
  }, []);

  return { ...images, loading, save };
}
