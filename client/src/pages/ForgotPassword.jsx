import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
          SECURITY
        </span>
      </div>

      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_#facc15] mb-2 transform -rotate-1">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">
            Reset Password
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            Enter your email and we'll send you a secure 1-hour password reset link
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#151722] border-2 border-white/20 rounded-3xl shadow-[6px_6px_0px_0px_#ef4444] p-8 space-y-6">
          {isSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-emerald-500 text-black border-2 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#fff]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Check Your Inbox</h3>
                <p className="text-xs text-gray-300 font-medium mt-1">
                  We've sent a password reset email to <strong className="text-yellow-400 font-bold">{email}</strong>.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider text-xs rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#ef4444] transition-all mt-2"
              >
                Return to Login →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-2">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#facc15] hover:shadow-[6px_6px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isLoading ? "Sending Link..." : "Send Password Reset Link →"}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-xs font-black text-yellow-400 hover:text-yellow-300 underline underline-offset-4"
                >
                  ← Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
