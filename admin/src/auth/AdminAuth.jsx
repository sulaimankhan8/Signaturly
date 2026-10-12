import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { adminApi, errorText } from "../api/admin.api.js";
import { getToken, endSession, expiryOf, onSessionChange } from "./session.js";
import { Button } from "../components/ui/basics.jsx";

const AdminContext = createContext(null);

/**
 * Who is signed in, and what the server says about plans and statuses.
 * The app holds no prices or plan names of its own: they come from here.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(AdminContext);

// Guards every screen but sign-in. One place, so no screen checks the token for itself.
export default function RequireAdmin() {
  const location = useLocation();
  const token = useSyncExternalStore(onSessionChange, getToken);
  const [meta, setMeta] = useState(null);
  const [problem, setProblem] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Sign out at the moment the token runs out
  useEffect(() => {
    if (!token) return;
    const expiry = expiryOf(token);
    if (!expiry) return;
    const timer = setTimeout(() => endSession("ended"), Math.min(Math.max(expiry - Date.now(), 0), 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let current = true;
    adminApi
      .get("/admin/meta")
      .then((res) => {
        if (!current) return;
        setMeta(res.data.data);
        setProblem("");
      })
      .catch((err) => {
        if (current) setProblem(errorText(err, "The admin app could not be loaded."));
      });
    return () => {
      current = false;
    };
  }, [token, attempt]);

  const value = useMemo(() => {
    if (!meta) return null;
    const planOf = (id) => meta.plans.find((plan) => plan.id === id);
    // `refresh` reads the details again, for when a screen has changed what they say (the plans)
    return { ...meta, planOf, planName: (id) => planOf(id)?.label || planOf(id)?.name || id, refresh: () => setAttempt((n) => n + 1) };
  }, [meta]);

  if (!token) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;

  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        {problem ? (
          <div className="max-w-sm text-center space-y-4" role="alert">
            <p className="text-ink">{problem}</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        ) : (
          <p className="text-ink-muted" role="status">
            Loading…
          </p>
        )}
      </div>
    );
  }

  return (
    <AdminContext.Provider value={value}>
      <Outlet />
    </AdminContext.Provider>
  );
}
