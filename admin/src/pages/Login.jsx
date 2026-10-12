import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { adminApi, errorCode, errorText } from "../api/admin.api.js";
import { getToken, startSession, takeNote } from "../auth/session.js";
import { Brand, Button, Field, Input } from "../components/ui/basics.jsx";

/**
 * Signing in to the admin app: the account's email and password, the admin key, and,
 * when the account has two-step sign-in, the code from its authenticator app.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "", adminSecret: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Why the last session ended, read once
  const [note] = useState(() => takeNote());

  const destination = typeof location.state?.from === "string" && location.state.from.startsWith("/") ? location.state.from : "/overview";
  if (getToken()) return <Navigate to={destination} replace />;

  const set = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const res = await adminApi.post("/admin/login", {
        email: form.email.trim(),
        password: form.password,
        adminSecret: form.adminSecret.trim(),
        ...(needsCode && form.code.trim() ? { code: form.code.trim() } : {}),
      });
      startSession(res.data.adminToken);
      navigate(destination, { replace: true });
    } catch (err) {
      const code = errorCode(err);
      if (code === "TWO_FACTOR_CODE_NEEDED") {
        // The password and key were right; only the code is still wanted
        setNeedsCode(true);
      } else if (err.response?.status === 429) {
        setError("Too many tries. Sign-in is paused for 15 minutes.");
      } else if (err.response?.status === 401 && !code) {
        setError("The email, password or admin key is not right.");
      } else {
        setError(errorText(err, "Sign-in did not work. Try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Brand />
        </div>

        <div className="panel shadow-hard-lg p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="text-sm text-ink-muted mt-1">For the people who run PactDoc.</p>

          {note && !error && (
            <p role="status" className="notice text-ink mt-4">
              {note}
            </p>
          )}
          {error && (
            <p role="alert" className="notice notice-red mt-4">
              {error}
            </p>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="username" placeholder="admin@pactdoc.com" value={form.email} onChange={set("email")} required autoFocus disabled={needsCode} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" placeholder="••••••••••••" value={form.password} onChange={set("password")} required disabled={needsCode} />
            </Field>
            <Field label="Admin key" help="The value of ADMIN_SECRET_KEY set on the server.">
              <Input type="password" autoComplete="off" placeholder="Enter Admin Secret Key" value={form.adminSecret} onChange={set("adminSecret")} required disabled={needsCode} />
            </Field>

            {needsCode && (
              <Field label="Code from your authenticator app" help="Six digits. A recovery code works too.">
                <Input inputMode="numeric" autoComplete="one-time-code" value={form.code} onChange={set("code")} required autoFocus />
              </Field>
            )}

            <Button type="submit" variant="primary" busy={busy} className="w-full">
              {busy ? "Signing in…" : needsCode ? "Confirm and sign in" : "Sign in"}
            </Button>
            {needsCode && (
              <Button
                variant="quiet"
                className="w-full"
                onClick={() => {
                  setNeedsCode(false);
                  setForm((old) => ({ ...old, code: "" }));
                  setError("");
                }}
              >
                Use a different account
              </Button>
            )}
          </form>
        </div>

        <p className="text-xs text-ink-faint text-center mt-4">Sign-ins and what is done here are recorded.</p>
      </div>
    </div>
  );
}
