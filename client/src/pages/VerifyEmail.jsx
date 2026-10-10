import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { verifyEmailApi, resendVerificationApi } from "../api/auth.api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const user = useSelector((state) => state.auth.user);

  // "checking" | "confirmed" | "failed" | "idle" (opened without a link)
  const [status, setStatus] = useState(token ? "checking" : "idle");
  const [isResending, setIsResending] = useState(false);
  const hasSubmitted = useRef(false);

  useEffect(() => {
    // The link works once, so guard against the effect running twice in development
    if (!token || hasSubmitted.current) return;
    hasSubmitted.current = true;

    verifyEmailApi(token)
      .then(() => setStatus("confirmed"))
      .catch(() => setStatus("failed"));
  }, [token]);

  const handleResend = async () => {
    try {
      setIsResending(true);
      await resendVerificationApi();
      toast.success("Confirmation email sent. Check your inbox.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send the email. Please try again later.");
    } finally {
      setIsResending(false);
    }
  };

  const heading = {
    checking: "Confirming your email…",
    confirmed: "Email confirmed",
    failed: "This link did not work",
    idle: "Confirm your email",
  }[status];

  const body = {
    checking: "One moment.",
    confirmed: "Your address is confirmed. You can now send documents for signature.",
    failed: "The confirmation link is invalid or has expired. Sign in and request a new one.",
    idle: "We sent a confirmation link to your email address. Open it to finish setting up your account.",
  }[status];

  return (
    <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4 text-gray-100">
      <Toaster position="top-right" />
      <div className="bg-[#12141c] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
        <h1 className="text-2xl font-bold text-white">{heading}</h1>
        <p className="text-sm text-gray-400 leading-relaxed">{body}</p>

        <div className="flex flex-col gap-2 pt-2">
          {status === "confirmed" && (
            <Link
              to={user ? "/dashboard" : "/login"}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {user ? "Go to dashboard" : "Sign in"}
            </Link>
          )}

          {(status === "failed" || status === "idle") && user && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {isResending ? "Sending…" : "Send a new confirmation email"}
            </button>
          )}

          {(status === "failed" || status === "idle") && !user && (
            <Link
              to="/login"
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
