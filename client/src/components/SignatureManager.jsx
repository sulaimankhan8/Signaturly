import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import SignaturePad from "./SignaturePad";
import TypeSignature from "./TypeSignature";
import VerifiedESignBadge from "./VerifiedESignBadge";
import InitialsStudio from "./InitialsStudio";
import SignatureWorker from "../workers/signature.worker.js?worker";
import { LIGHT } from "./signature/lightTheme";
import { fitImage } from "./signature/canvasTools";

/**
 * Making a signature, initials or a company stamp.
 *
 * kinds      which of "signature", "initials" and "stamp" this person needs
 * kind       which one to start on
 * current    what they already have: { signature, initials, stamp } as image data URLs
 * onAdopt(kind, dataUrl)  called with the new image ("" when it is cleared)
 *
 * Nothing is kept in the browser: a signer's signature lasts for their visit, and an account
 * holder's is saved with their account (see useSavedSignature).
 */
export default function SignatureManager({ kinds = ["signature", "initials"], kind = "signature", current = {}, onAdopt, signerName = "" }) {
  const { t } = useTranslation();
  const [section, setSection] = useState(kinds.includes(kind) ? kind : kinds[0]);
  const [sigTab, setSigTab] = useState("type"); // type | draw | esign | upload

  useEffect(() => {
    if (kinds.includes(kind)) setSection(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const sectionLabel = { signature: t("sig.fullSignature"), initials: t("sig.initials"), stamp: t("sig.stamp") };
  const adopt = (dataUrl) => onAdopt(section, dataUrl);

  return (
    <div className="space-y-4">
      {kinds.length > 1 && (
        <div className={LIGHT.tabs} role="tablist" aria-label={t("sidebar.studioTitle")}>
          {kinds.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={LIGHT.tab(section === id)}>
              {sectionLabel[id]}
              {current[id] ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {section === "signature" && (
        <div className="space-y-4">
          <div className={LIGHT.tabs} role="tablist" aria-label={t("sig.fullSignature")}>
            {[
              { id: "type", labelKey: "sig.tabType" },
              { id: "draw", labelKey: "sig.tabDraw" },
              { id: "esign", labelKey: "sig.tabStamp" },
              { id: "upload", labelKey: "sig.tabUpload" },
            ].map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={sigTab === tab.id} onClick={() => setSigTab(tab.id)} className={LIGHT.tab(sigTab === tab.id)}>
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {sigTab === "type" && <TypeSignature defaultText={signerName} onConfirm={adopt} />}
          {sigTab === "draw" && <SignaturePad onConfirm={adopt} />}
          {sigTab === "esign" && <VerifiedESignBadge defaultName={signerName} onConfirm={adopt} />}
          {sigTab === "upload" && <ImageUpload onConfirm={adopt} removeBackgroundByDefault />}
        </div>
      )}

      {section === "initials" && <InitialsStudio defaultName={signerName} onConfirm={adopt} />}

      {section === "stamp" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-700">{t("sig.stampHint")}</p>
          <ImageUpload onConfirm={adopt} removeBackgroundByDefault={false} />
        </div>
      )}

      {current[section] && (
        <div className="p-3 bg-emerald-50 border-2 border-black rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black uppercase tracking-wider text-emerald-800">
              {section === "initials" ? t("sig.activeInitials") : section === "stamp" ? t("sig.activeStamp") : t("sig.active")}
            </span>
            <button type="button" onClick={() => onAdopt(section, "")} className={LIGHT.quiet}>
              {t("sig.clear")}
            </button>
          </div>
          <div className="bg-white border-2 border-black/10 p-2 rounded-lg flex items-center justify-center">
            <img src={current[section]} alt={sectionLabel[section]} className="max-h-14 object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A picture of a signature or seal. A photo of ink on paper can have the paper taken out, so
 * only the ink is placed on the document.
 */
function ImageUpload({ onConfirm, removeBackgroundByDefault }) {
  const { t } = useTranslation();
  const [removeBackground, setRemoveBackground] = useState(removeBackgroundByDefault);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const withoutPaper = (bitmap) =>
    new Promise((resolve, reject) => {
      if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
        resolve(null);
        return;
      }
      const worker = new SignatureWorker();
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };
      worker.postMessage({ imageBitmap: bitmap, strength: 1.2 }, [bitmap]);
    });

  const take = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("sig.invalidImage"));
      return;
    }
    setBusy(true);
    try {
      let image = file;
      if (removeBackground) {
        const cleaned = await withoutPaper(await createImageBitmap(file));
        if (cleaned) image = cleaned;
      }
      onConfirm(await fitImage(image));
      toast.success(t("sig.uploaded"));
    } catch {
      toast.error(t("sig.invalidImage"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label
        className={`border-2 border-dashed border-black rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
          dragging ? "bg-yellow-100" : "bg-white hover:bg-yellow-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
      >
        {busy ? (
          <span className="w-8 h-8 border-4 border-black/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label={t("toast.working")} />
        ) : (
          <>
            <span className="text-xs font-black uppercase tracking-wider text-black">{t("sig.uploadTitle")}</span>
            <span className="text-[11px] text-gray-600 mt-1">{t("sig.uploadHint")}</span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => take(e.target.files?.[0])} className="sr-only" />
      </label>
      <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer select-none">
        <input type="checkbox" checked={removeBackground} onChange={(e) => setRemoveBackground(e.target.checked)} className="w-4 h-4 accent-red-600" />
        {t("sig.removeBackground")}
      </label>
    </div>
  );
}
