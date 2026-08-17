import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPasswordApi } from "../api/user.api";
import toast, { Toaster } from "react-hot-toast";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsLoading(true);
      await forgotPasswordApi(email.trim());
      setIsSent(true);
      toast.success("Password reset instructions dispatched!");
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error(err.response?.data?.message || "Failed to process request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 flex items-center justify-center p-4 selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <div className="max-w-md w-full space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 via-red-700 to-red-950 rounded-2xl shadow-xl shadow-red-950/50 border border-red-500/30 mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">
            Reset Password
          </h2>
          <p className="text-xs text-gray-400">
            Enter your email and we'll send you a secure 1-hour password reset link
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#12141c] border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
          {isSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Check Your Inbox</h3>
                <p className="text-xs text-gray-400 mt-1">
                  We've sent a password reset email to <strong className="text-white">{email}</strong>.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-colors mt-2"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isLoading ? "Sending Link..." : "Send Password Reset Link"}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
