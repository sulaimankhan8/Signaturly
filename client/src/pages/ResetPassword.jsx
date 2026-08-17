import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordApi } from "../api/user.api";
import toast, { Toaster } from "react-hot-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Password reset token is missing from the URL");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      await resetPasswordApi({ token, newPassword });
      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error(err.response?.data?.message || "Invalid or expired reset token");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#08090d] text-gray-100 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <h2 className="text-xl font-display font-bold text-white">Invalid Reset Link</h2>
          <p className="text-xs text-gray-400">
            This password reset link is invalid or incomplete. Please request a new link.
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 flex items-center justify-center p-4 selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <div className="max-w-md w-full space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 via-red-700 to-red-950 rounded-2xl shadow-xl shadow-red-950/50 border border-red-500/30 mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">
            Create New Password
          </h2>
          <p className="text-xs text-gray-400">Enter a secure new password for your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#12141c] border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                New Password (min. 6 characters)
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showPass"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="accent-red-600 rounded"
              />
              <label htmlFor="showPass" className="text-xs text-gray-400 cursor-pointer">
                Show passwords
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {isLoading ? "Updating Password..." : "Set New Password & Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
