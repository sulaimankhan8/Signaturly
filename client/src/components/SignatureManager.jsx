import { useState } from "react";
import SignaturePad from "./SignaturePad";
import TypeSignature from "./TypeSignature";
import VerifiedESignBadge from "./VerifiedESignBadge";
import InitialsStudio from "./InitialsStudio";
import toast from "react-hot-toast";

export default function SignatureManager({
  onUploaded,
  onInitialsUploaded = () => {},
  defaultSignatureUrl = "",
  defaultInitialsUrl = "",
  signerName = "",
}) {
  const [managerMode, setManagerMode] = useState("signature"); // signature | initials
  const [sigTab, setSigTab] = useState("esign"); // esign | draw | type | upload
  const [signatureUrl, setSignatureUrl] = useState(defaultSignatureUrl);
  const [initialsUrl, setInitialsUrl] = useState(defaultInitialsUrl);

  const handleSignatureCapture = (dataUrl) => {
    setSignatureUrl(dataUrl);
    onUploaded(dataUrl);
    localStorage.setItem("signaturly_default_signature", dataUrl);
  };

  const handleInitialsCapture = (dataUrl) => {
    setInitialsUrl(dataUrl);
    onInitialsUploaded(dataUrl);
    localStorage.setItem("signaturly_default_initials", dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      if (managerMode === "signature") {
        handleSignatureCapture(dataUrl);
      } else {
        handleInitialsCapture(dataUrl);
      }
      toast.success("Uploaded asset attached!");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Top Toggle: Full Signature vs Initials */}
      <div className="flex bg-[#08090d] p-1 rounded-2xl border border-white/10 shadow-inner">
        <button
          type="button"
          onClick={() => setManagerMode("signature")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            managerMode === "signature"
              ? "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-md border border-red-500/30"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Full Signature
        </button>

        <button
          type="button"
          onClick={() => setManagerMode("initials")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            managerMode === "initials"
              ? "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-md border border-red-500/30"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <span className="font-mono text-xs border border-current px-1 rounded">SK</span>
          Initials
        </button>
      </div>

      {managerMode === "signature" ? (
        <div className="space-y-4">
          {/* Subtabs for Signature */}
          <div className="flex bg-[#08090d] p-1 rounded-xl border border-white/10">
            {[
              { id: "esign", label: "★ E-Sign Stamp" },
              { id: "draw", label: "Draw" },
              { id: "type", label: "Type" },
              { id: "upload", label: "Upload" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSigTab(tab.id)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  sigTab === tab.id
                    ? "bg-white/15 text-white shadow border border-white/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sigTab === "esign" && (
            <VerifiedESignBadge
              defaultName={signerName}
              onConfirm={handleSignatureCapture}
            />
          )}

          {sigTab === "draw" && (
            <SignaturePad onConfirm={handleSignatureCapture} />
          )}

          {sigTab === "type" && (
            <TypeSignature
              defaultText={signerName}
              onConfirm={handleSignatureCapture}
            />
          )}

          {sigTab === "upload" && (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-white/10 hover:border-red-500/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#08090d]/60">
                <svg className="w-8 h-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-bold text-white">Upload Signature Image</span>
                <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WebP supported</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Signature Preview */}
          {signatureUrl && (
            <div className="p-3 bg-[#08090d] border border-emerald-800/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Active Signature
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSignatureUrl("");
                    onUploaded("");
                  }}
                  className="text-gray-400 hover:text-red-400 text-[11px]"
                >
                  Clear
                </button>
              </div>
              <div className="bg-white p-2 rounded-lg flex items-center justify-center max-h-16 overflow-hidden">
                <img src={signatureUrl} alt="Active Signature" className="max-h-12 object-contain" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <InitialsStudio
            defaultName={signerName}
            onConfirm={handleInitialsCapture}
          />

          {/* Initials Preview */}
          {initialsUrl && (
            <div className="p-3 bg-[#08090d] border border-emerald-800/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Active Initials
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInitialsUrl("");
                    onInitialsUploaded("");
                  }}
                  className="text-gray-400 hover:text-red-400 text-[11px]"
                >
                  Clear
                </button>
              </div>
              <div className="bg-white p-2 rounded-lg flex items-center justify-center max-h-16 overflow-hidden">
                <img src={initialsUrl} alt="Active Initials" className="max-h-12 object-contain" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
