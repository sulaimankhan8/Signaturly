import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setTermsAccepted } from "../store/authSlice";
import { acceptTermsApi } from "../api/auth.api";
import toast from "react-hot-toast";

export default function TermsConsentModal() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.accessToken);
  const dispatch = useDispatch();

  const [hasScrolled, setHasScrolled] = useState(false);
  const [consentEsign, setConsentEsign] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is not logged in or has already accepted terms, do not render modal
  if (!user || user.termsAccepted) {
    return null;
  }

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasScrolled(true);
    }
  };

  const handleAccept = async () => {
    if (!consentEsign || !consentTerms) return;
    setIsSubmitting(true);
    try {
      const data = await acceptTermsApi(token);
      dispatch(setTermsAccepted(data));
      toast.success("Terms & Statutory Compliance Accepted!");
    } catch (err) {
      console.error("Error accepting terms:", err);
      toast.error(err.response?.data?.message || "Failed to record terms acceptance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn selection:bg-yellow-400 selection:text-black">
      <div className="bg-[#11131f] border-2 border-yellow-400/40 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.2)] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden text-gray-100 font-sans relative">
        
        {/* Top Header */}
        <div className="px-6 py-5 bg-[#171a2b] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 border-2 border-black shadow-[2px_2px_0px_0px_#facc15] flex items-center justify-center font-black text-white text-lg">
              📜
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                Mandatory Legal Compliance & Terms
                <span className="text-[10px] bg-yellow-400 text-black font-black px-2 py-0.5 rounded border border-black uppercase">
                  v1.0.0 Statutory
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                BoloSign & DocuSign Compliant Electronic Record & Signature Consent
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Terms Body */}
        <div 
          onScroll={handleScroll}
          className="p-6 overflow-y-auto space-y-5 text-xs text-gray-300 leading-relaxed font-sans bg-[#0c0e17]/80 scrollbar-thin scrollbar-thumb-yellow-500/20 scrollbar-track-transparent max-h-[50vh]"
        >
          {/* Notice Alert */}
          <div className="p-3.5 bg-yellow-500/10 border-l-4 border-yellow-400 rounded-r-xl text-yellow-200 text-xs font-semibold">
            ⚖️ <strong>Legal Notice:</strong> Under the U.S. ESIGN Act (15 U.S.C. § 7001), Section 10A of the Indian IT Act 2000, and EU eIDAS Regulation (No 910/2014), you must explicitly assent to electronic disclosures and legal terms before utilizing the Signaturly Pro platform.
          </div>

          {/* Section 1 */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-400 font-mono">1.</span> Electronic Record & Signature Disclosure (ERSD)
            </h3>
            <p>
              By accessing and utilizing Signaturly Pro, you expressly consent to receive, execute, send, and store all contracts, legal notices, audit logs, and transaction records in electronic format. You agree that your electronic signature, typed name, drawn mark, image seal, or One-Time Password (OTP) verification carries identical legal enforceability, validity, and admissibility as a wet-ink paper signature under applicable federal, state, and international laws.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-400 font-mono">2.</span> Identity Authenticity & Non-Repudiation Covenants
            </h3>
            <p>
              You represent and warrant that all user credentials, email addresses, phone numbers, and identity attributes provided under your account belong exclusively to you or an authorized entity you legally represent. You irrevocably waive any right to claim non-repudiation or deny the legal binding effect of any document executed through your authenticated session or assigned OTP channels.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-400 font-mono">3.</span> Immutable Audit Trail & Metadata Logging Authorization
            </h3>
            <p>
              You authorize Signaturly Pro to log, capture, hash, and cryptographically bind transaction metadata to every executed document, including but not limited to your IP address, browser user-agent string, exact UTC timestamps, email verification logs, and pre/post-execution SHA-256 document checksums. This metadata forms a permanent, tamper-evident legal Audit Certificate appended to executed files.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-400 font-mono">4.</span> Hardware & Software System Requirements
            </h3>
            <p>
              To access and retain electronic records, you require an active internet connection, a modern web browser supporting 256-bit SSL/TLS encryption (e.g., Chrome, Brave, Firefox, Edge, Safari), and a standard PDF reader capable of rendering ISO 32000-1 documents. You have the right to request or download PDF copies of your signed agreements at any time without fee.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-400 font-mono">5.</span> Anti-Fraud, Acceptable Use & Limitation of Liability
            </h3>
            <p>
              You agree not to upload fraudulent documents, impersonate third parties without formal power of attorney, or engage in unauthorized system exploitation. Signaturly Pro provides secure digital signature infrastructure; final contractual rights and performance remain the sole responsibility of the signing parties.
            </p>
          </div>

          {!hasScrolled && (
            <div className="text-center py-2 text-[11px] font-bold text-yellow-400 animate-pulse">
              ↓ Please scroll through to review full compliance disclosures ↓
            </div>
          )}
        </div>

        {/* Verification Checkboxes & Action Bar */}
        <div className="p-6 bg-[#171a2b] border-t border-white/10 space-y-4">
          <div className="space-y-3">
            {/* Checkbox 1 */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentEsign}
                onChange={(e) => setConsentEsign(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-black text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 cursor-pointer accent-yellow-400"
              />
              <span className="text-xs text-gray-200 font-medium group-hover:text-white transition-colors">
                I express <strong>explicit statutory consent</strong> to execute agreements, receive disclosures, and conduct transactions electronically under ESIGN Act, IT Act 2000, and eIDAS Regulations.
              </span>
            </label>

            {/* Checkbox 2 */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-black text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 cursor-pointer accent-yellow-400"
              />
              <span className="text-xs text-gray-200 font-medium group-hover:text-white transition-colors">
                I have read and agree to the <strong>Signaturly Pro Terms of Service</strong>, Audit Trail IP Recording Policy, and Anti-Fraud Covenants.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAccept}
            disabled={!consentEsign || !consentTerms || isSubmitting}
            className={`w-full py-3.5 px-6 rounded-xl font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${
              consentEsign && consentTerms && !isSubmitting
                ? "bg-red-600 hover:bg-red-500 text-white border-black shadow-[4px_4px_0px_0px_#facc15] hover:shadow-[6px_6px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer"
                : "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-60"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Recording Audit Attestation...</span>
              </>
            ) : (
              <span>ACCEPT & PROCEED TO VAULT →</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
