"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create account. Please check your information.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration error occurred.");
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
          Create Your Workspace
        </h2>
        <p className="text-xs text-content-muted">
          5 free envelope executions each month · No credit card required
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
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alexander Wright"
                className="w-full bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexander@company.com"
                className="w-full bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-surface-canvas border border-surface-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson"
              />
            </div>

            <p className="text-[11px] text-content-muted leading-relaxed">
              By creating an account, you agree to the{" "}
              <Link href="/terms" className="text-content-secondary underline hover:text-white">
                Terms of Service
              </Link>{" "}
              and acknowledge the ESIGN and eIDAS compliance frameworks.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-crimson hover:bg-crimson-hover disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-elevation-1 hover:shadow-crimson-glow transition-all cursor-pointer"
            >
              {loading ? "Creating Workspace..." : "Get Started Free →"}
            </button>
          </form>

          <div className="pt-4 border-t border-surface-border text-center text-xs text-content-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-white hover:text-crimson transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
