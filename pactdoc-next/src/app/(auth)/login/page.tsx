"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          ...(needs2FA && code.trim() ? { code: code.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.message?.includes("TWO_FACTOR_CODE_NEEDED")) {
          setNeeds2FA(true);
          return;
        }
        throw new Error(data.message || "Failed to sign in. Please verify your credentials.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected sign-in error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-content-primary">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-crimson flex items-center justify-center font-black text-white shadow-elevation-1">
            P
          </div>
          <span className="font-black text-xl tracking-tight text-white uppercase">
            Pact<span className="text-crimson">Doc</span>
          </span>
        </Link>
        <h2 className="text-2xl font-black uppercase text-white tracking-tight">
          {needs2FA ? "Two-Factor Verification" : "Sign In to Your Workspace"}
        </h2>
        <p className="text-xs text-content-muted">
          {needs2FA
            ? "Enter the 6-digit code from your authenticator app"
            : "Access your documents, audit certificates, and active envelopes"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-surface-card border border-surface-border rounded-3xl p-6 sm:p-8 shadow-elevation-2 space-y-6">
          {error && (
            <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-3 text-xs text-red-200 font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!needs2FA ? (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] text-content-muted hover:text-crimson transition-colors"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-crimson hover:bg-crimson-hover disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-elevation-1 hover:shadow-crimson-glow transition-all cursor-pointer"
            >
              {loading ? "Authenticating..." : needs2FA ? "Verify Code →" : "Sign In →"}
            </button>
          </form>

          <div className="pt-4 border-t border-surface-border text-center text-xs text-content-muted">
            Don't have an account?{" "}
            <Link href="/register" className="font-bold text-white hover:text-crimson transition-colors">
              Create workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
