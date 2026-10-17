import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchUserProfileApi, updateUserProfileApi, changePasswordApi } from "../api/user.api";
import { setCredentials } from "../store/authSlice";
import Navbar from "../components/Navbar";
import SignatureStudio from "../components/signature/SignatureStudio";
import { useSavedSignature } from "../components/signature/useSavedSignature";
import toast, { Toaster } from "react-hot-toast";

import TwoFactorSettings from "../components/TwoFactorSettings";

export default function Settings() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'billing' | 'security' | 'signatures' | 'enterprise'
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // The signature and initials saved with the account
  const saved = useSavedSignature();
  const [studio, setStudio] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchUserProfileApi();
        setProfile(data);
        setName(data.name || "");
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    };
    loadProfile();

    // Check if redirected with ?tab=
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["profile", "billing", "security", "signatures", "enterprise"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated successfully!");
    }
  }, []);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const updated = await updateUserProfileApi(name.trim());
      setProfile((prev) => ({ ...prev, name: updated.name }));
      dispatch(setCredentials({ accessToken, user: { ...authUser, name: updated.name } }));
      toast.success("Profile name updated successfully!");
    } catch (err) {
      console.error("Update profile error:", err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 10) {
      toast.error("New password must be at least 10 characters long");
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePasswordApi({ currentPassword, newPassword });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change password error:", err);
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveSignature = async (kind, dataUrl) => {
    setStudio(null);
    try {
      await saved.save(kind, dataUrl);
      toast.success(dataUrl ? "Saved to your account." : "Removed from your account.");
    } catch {
      toast.error("It could not be saved. Please try again.");
    }
  };

  const tabs = [
    {
      id: "profile",
      label: "Profile & Account",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "billing",
      label: "Plans & billing",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: "security",
      label: "Security & Password",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: "signatures",
      label: "Signature Studio",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    {
      id: "enterprise",
      label: "Enterprise & APIs",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-full">
                Account Settings
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Vault &amp; Workspace Preferences
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Manage your personal identity, subscription tier, signing credentials, and team integrations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/billing/plans")}
              className="px-4 py-2 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#ef4444] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current text-black" viewBox="0 0 20 20">
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
              </svg>
              <span>Upgrade Plan</span>
            </button>
          </div>
        </div>

        {/* Modern Responsive Navigation Tab Bar */}
        <div className="bg-[#12141c] p-1.5 rounded-2xl border border-white/10 flex flex-wrap gap-1.5 shadow-xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-red-600 text-white shadow-lg shadow-red-950/60 font-black"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile & Account */}
        {activeTab === "profile" && (
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-lg font-black text-white">Personal Identity &amp; Profile</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                This name will appear on all audit trails, certificates, and documents you send.
              </p>
            </div>

            <form onSubmit={handleUpdateName} className="space-y-5 max-w-lg">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Full Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Email Address (Primary Identity)
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || authUser?.email || ""}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-gray-400 text-xs cursor-not-allowed font-mono opacity-80"
                />
                <span className="text-[11px] text-gray-400 mt-1.5 block">
                  Email cannot be modified directly to preserve statutory audit trail integrity and SHA-256 seal verification.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 transition-all cursor-pointer"
                >
                  {isUpdatingProfile ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Billing & Plans. The plan, documents, wallet and invoices are on one page of their own. */}
        {activeTab === "billing" && (
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">Plans &amp; billing</h2>
              <p className="text-sm text-gray-400 mt-1 max-w-xl leading-relaxed">
                Your plan, the documents you have used this month, extra documents, the wallet for SMS and WhatsApp, and your invoices are together on one page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/billing")}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 transition-all cursor-pointer"
            >
              Open plans &amp; billing
            </button>
          </div>
        )}

        {/* Tab 3: Security & Password */}
        {activeTab === "security" && (
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-lg font-black text-white">Security &amp; Password</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Update your vault authentication password and ensure high-entropy credentials.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  New Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 transition-all cursor-pointer"
                >
                  {isChangingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Two-step sign-in sits with the password, under Security */}
        {activeTab === "security" && (
          <div className="mt-6">
            <TwoFactorSettings />
          </div>
        )}

        {/* Tab 4: Signature Studio */}
        {activeTab === "signatures" && (
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-lg font-black text-white">Your signature and initials</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Saved with your account, so they are ready whenever you sign your own documents, on any device. Nothing is kept in this browser.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {[
                ["signature", "Signature"],
                ["initials", "Initials"],
              ].map(([kind, words]) => (
                <div key={kind} className="bg-[#08090d] p-4 rounded-2xl border-2 border-white/15 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-300">{words}</p>
                  <div className="h-24 rounded-xl bg-white border-2 border-black flex items-center justify-center p-2">
                    {saved[kind] ? (
                      <img src={saved[kind]} alt={`Your ${words.toLowerCase()}`} className="max-h-20 max-w-full object-contain" />
                    ) : (
                      <span className="text-xs font-bold text-gray-500">{saved.loading ? "Loading…" : "None yet"}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStudio(kind)}
                      className="flex-1 min-h-[40px] rounded-xl border-2 border-black bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#facc15]"
                    >
                      {saved[kind] ? "Change" : "Create"}
                    </button>
                    {saved[kind] && (
                      <button
                        type="button"
                        onClick={() => handleSaveSignature(kind, "")}
                        className="min-h-[40px] px-3 rounded-xl border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <SignatureStudio
              open={Boolean(studio)}
              onClose={() => setStudio(null)}
              kinds={["signature", "initials"]}
              kind={studio || "signature"}
              current={{ signature: saved.signature, initials: saved.initials }}
              onAdopt={handleSaveSignature}
              signerName={authUser?.name || ""}
            />
          </div>
        )}

        {/* Tab 5: Enterprise & APIs */}
        {activeTab === "enterprise" && (
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Enterprise Organizations &amp; Developer Tools</h2>
                <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/40">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Manage multi-tenant workspaces, team member seats, custom white-labeling, REST API keys, and webhooks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-[#08090d] p-6 rounded-2xl border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-white">Team Workspaces &amp; White-Labeling</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Invite team members, assign RBAC roles (Admin, Member, Viewer), and customize company branding and email footers.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/workspaces")}
                  className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  Manage Workspaces →
                </button>
              </div>

              <div className="bg-[#08090d] p-6 rounded-2xl border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-white">Developer REST API &amp; Webhooks</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Generate HMAC scoped API keys (<code>pd_live_...</code>) and stream signing lifecycle webhooks directly to your servers.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/developer")}
                  className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  Open API Dashboard →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
