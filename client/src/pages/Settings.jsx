import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchUserProfileApi, updateUserProfileApi, changePasswordApi } from "../api/user.api";
import { setCredentials } from "../store/authSlice";
import Navbar from "../components/Navbar";
import SignatureManager from "../components/SignatureManager";
import toast, { Toaster } from "react-hot-toast";

export default function Settings() {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Signature preference
  const [savedSignature, setSavedSignature] = useState(
    localStorage.getItem("signaturly_default_signature") || ""
  );

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
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
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

  const handleSaveSignature = (dataUrl) => {
    setSavedSignature(dataUrl);
    if (dataUrl) {
      localStorage.setItem("signaturly_default_signature", dataUrl);
      toast.success("Default signature saved locally!");
    } else {
      localStorage.removeItem("signaturly_default_signature");
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div>
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444] mb-2 inline-block">
            Vault Preferences
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
            Account Settings
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm mt-1 font-medium">
            Manage your personal profile, security credentials, and default signature assets.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-[#13151f] p-1.5 rounded-2xl border-2 border-white/20 max-w-md gap-1 shadow-[3px_3px_0px_0px_#000]">
          {[
            { id: "profile", label: "Profile & Account" },
            { id: "security", label: "Security & Password" },
            { id: "signatures", label: "Signature Studio" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile */}
        {activeTab === "profile" && (
          <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
            <h2 className="text-base font-black text-white uppercase">Personal Profile</h2>

            <form onSubmit={handleUpdateName} className="space-y-5 max-w-lg">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Email Address (Primary)
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || authUser?.email || ""}
                  className="w-full p-3 bg-[#090a0f] border-2 border-white/10 rounded-xl text-gray-400 text-xs cursor-not-allowed font-mono"
                />
                <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                  Email cannot be changed directly for statutory security and audit trail integrity.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-[3px_3px_0px_0px_#facc15] border-2 border-black transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  {isUpdatingProfile ? "Saving Changes..." : "Save Profile →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === "security" && (
          <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
            <div>
              <h2 className="text-base font-black text-white uppercase">Change Account Password</h2>
              <p className="text-gray-300 text-xs mt-0.5 font-medium">Ensure your account is using a long, random password.</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                  New Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-[3px_3px_0px_0px_#facc15] border-2 border-black transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                >
                  {isChangingPassword ? "Updating Password..." : "Update Password →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Signatures */}
        {activeTab === "signatures" && (
          <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
            <div>
              <h2 className="text-base font-black text-white uppercase">Default E-Signature Asset</h2>
              <p className="text-gray-300 text-xs mt-0.5 font-medium">
                Draw, type, or upload your signature once. It will be pre-loaded when you sign documents.
              </p>
            </div>

            <div className="max-w-lg bg-[#090a0f] p-6 rounded-2xl border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
              <SignatureManager
                defaultSignatureUrl={savedSignature}
                onUploaded={handleSaveSignature}
              />
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
