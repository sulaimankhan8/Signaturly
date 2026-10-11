import { useEffect } from "react";
import { setActiveWorkspaceId } from "../utils/workspace";

/**
 * Where the browser lands after signing in through an organisation's identity provider.
 * The session already exists; this opens the organisation's workspace and goes to the dashboard.
 */
export default function SsoDone() {
  useEffect(() => {
    const workspace = new URLSearchParams(window.location.search).get("workspace");
    if (workspace && /^[a-f0-9]{24}$/i.test(workspace)) setActiveWorkspaceId(workspace);
    window.location.replace("/dashboard");
  }, []);

  return (
    <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
    </div>
  );
}
