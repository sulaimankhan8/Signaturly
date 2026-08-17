import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
      <div className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-[#151722] border-2 border-red-500 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-[6px_6px_0px_0px_#ef4444]">
          <h2 className="text-xl font-black uppercase text-white">Invalid Reset Link</h2>
          <p className="text-xs text-gray-300 font-medium">
            This password reset link is invalid or has expired. Please request a new link.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate("/forgot-password")}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-xs rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#facc15]"
            >
              Request New Link →
            </button>
            <Link to="/" className="text-xs font-bold text-gray-400 hover:text-white pt-2">
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col items-center justify-center p-4 selection:bg-yellow-400 selection:text-black font-sans antialiased relative">
      <Toaster position="top-right" />

      {/* Top Back to Home Navigation */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#151722] hover:bg-[#1f2233] text-gray-300 hover:text-white text-xs font-black uppercase tracking-wider border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Home</span>
        </Link>

        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444]">
          PASSWORD UPDATE
        </span>
      </div>

      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_#facc15] mb-2 transform rotate-1">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">
            Create New Password
          </h2>
          <p className="text-xs text-gray-400 font-medium">Enter a secure new password for your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#151722] border-2 border-white/20 rounded-3xl shadow-[6px_6px_0px_0px_#ef4444] p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                New Password (min. 6 characters)
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-medium"
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
              <label htmlFor="showPass" className="text-xs text-gray-300 font-bold cursor-pointer">
                Show passwords
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#facc15] hover:shadow-[6px_6px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50"
            >
              {isLoading ? "Updating Password..." : "Set New Password & Login →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
