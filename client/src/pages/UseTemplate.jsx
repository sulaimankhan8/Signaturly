import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { fetchTemplateDetailsApi, useTemplateApi } from "../api/template.api";
import Navbar from "../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

export default function UseTemplate() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);

  const [template, setTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [roleSigners, setRoleSigners] = useState({});
  const [signingOrder, setSigningOrder] = useState(false);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const data = await fetchTemplateDetailsApi(templateId);
        setTemplate(data);

        // Initialize role signers map
        const initialMap = {};
        (data.roles || []).forEach((r, idx) => {
          // If first role, default to current user
          if (idx === 0 && authUser) {
            initialMap[r.id] = { name: authUser.name || "", email: authUser.email || "" };
          } else {
            initialMap[r.id] = { name: "", email: "" };
          }
        });
        setRoleSigners(initialMap);
      } catch (err) {
        console.error("Error loading template for use:", err);
        toast.error("Failed to load template");
        navigate("/templates");
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplate();
  }, [templateId, navigate, authUser]);

  const updateSigner = (roleId, field, value) => {
    setRoleSigners((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [field]: value,
      },
    }));
  };

  const autoFillMe = (roleId) => {
    if (!authUser) return;
    setRoleSigners((prev) => ({
      ...prev,
      [roleId]: {
        name: authUser.name || "",
        email: authUser.email || "",
      },
    }));
    toast.success("Filled your account details!");
  };

  const handleSend = async (e) => {
    e.preventDefault();

    // Validate that each role has a valid email and name
    for (const role of template?.roles || []) {
      const signer = roleSigners[role.id];
      if (!signer?.name?.trim()) {
        toast.error(`Please provide a name for role: "${role.name}"`);
        return;
      }
      if (!signer?.email?.trim() || !signer.email.includes("@")) {
        toast.error(`Please provide a valid email address for role: "${role.name}"`);
        return;
      }
    }

    let toastId = null;
    try {
      setIsSending(true);
      toastId = toast.loading("Creating document & dispatching legally compliant invitations...");

      await useTemplateApi(templateId, {
        roleSignersMap: roleSigners,
        message,
        expiresAt,
        signingOrder,
      });

      if (toastId) toast.dismiss(toastId);
      toast.success("Document created and sent to all designated signers successfully!");
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error using template:", err);
      toast.error(err.response?.data?.message || "Failed to send document from template");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-red-400 font-bold uppercase tracking-wider mb-1">
              <span>Legally Compliant Template</span>
              <span>•</span>
              <span>1-Click Dispatch</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              {template?.name}
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              {template?.description || "Assign designated parties to this legally binding contract."}
            </p>
          </div>

          <button
            onClick={() => navigate("/templates")}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-xs font-bold"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-6">
          {/* Signers Mapping Card */}
          <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-white">Assign Signer Roles</h2>
                <p className="text-gray-400 text-xs mt-0.5">Specify who signs for each legal party.</p>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <input
                  type="checkbox"
                  checked={signingOrder}
                  onChange={(e) => setSigningOrder(e.target.checked)}
                  className="accent-red-600 rounded"
                />
                <span className="text-xs font-semibold text-gray-200">Sequential Signing</span>
              </label>
            </div>

            <div className="space-y-4 pt-2">
              {(template?.roles || []).map((role, idx) => (
                <div
                  key={role.id}
                  className="bg-[#08090d] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all"
                  style={{ borderLeftColor: role.color, borderLeftWidth: "4px" }}
                >
                  <div className="flex flex-col space-y-1 min-w-[140px]">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-6 h-6 rounded-md text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: role.color }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white truncate" title={role.name}>
                        {role.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => autoFillMe(role.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 text-left font-semibold underline"
                    >
                      Fill My Details
                    </button>
                  </div>

                  <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`e.g. John Doe`}
                      value={roleSigners[role.id]?.name || ""}
                      onChange={(e) => updateSigner(role.id, "name", e.target.value)}
                      className="w-full px-3 py-2 bg-[#12141c] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                      Signer Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="signer@company.com"
                      value={roleSigners[role.id]?.email || ""}
                      onChange={(e) => updateSigner(role.id, "email", e.target.value)}
                      className="w-full px-3 py-2 bg-[#12141c] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invitation Message Card */}
          <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <h2 className="text-base font-display font-bold text-white">Custom Message & Expiration</h2>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                Note for Signers (Included in Email)
              </label>
              <textarea
                rows={2}
                placeholder="Please review and e-sign this agreement."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="max-w-xs">
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Submit Trigger */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/templates")}
              className="px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all hover:scale-105"
            >
              {isSending ? "Dispatching Agreement..." : "Send Agreement Now →"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
