import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fetchWorkspacesApi } from "../api/workspace.api";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "../utils/workspace";

/**
 * Chooses which workspace the person is working in: their own documents or a team's.
 * Shown only to someone who belongs to more than one. Changing it reloads the page, so every
 * list on screen is read again for the workspace chosen.
 */
export default function WorkspaceSwitcher({ className = "" }) {
  const signedIn = useSelector((state) => Boolean(state.auth.accessToken));
  const [workspaces, setWorkspaces] = useState([]);
  const [active, setActive] = useState(getActiveWorkspaceId());

  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;
    fetchWorkspacesApi()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        setWorkspaces(list);
        // A remembered workspace the person has since left: go back to their own documents
        const remembered = getActiveWorkspaceId();
        if (remembered && !list.some((w) => String(w.id) === remembered)) {
          setActiveWorkspaceId("");
          setActive("");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn || workspaces.length < 2) return null;

  const personal = workspaces.find((w) => w.personal);
  const value = active && workspaces.some((w) => String(w.id) === active) ? active : String(personal?.id || "");

  const change = (event) => {
    const chosen = workspaces.find((w) => String(w.id) === event.target.value);
    setActiveWorkspaceId(chosen && !chosen.personal ? String(chosen.id) : "");
    window.location.reload();
  };

  return (
    <label className={`flex items-center gap-2 ${className}`} title="The workspace you are working in">
      <span className="sr-only">Workspace</span>
      <select
        value={value}
        onChange={change}
        data-testid="workspace-switcher"
        className="max-w-[11rem] truncate px-2.5 py-1.5 bg-[#151722] border border-white/20 rounded-lg text-xs font-bold text-gray-200 focus:outline-none focus:border-red-500"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={String(workspace.id)}>
            {workspace.personal ? "My documents" : workspace.name}
            {workspace.status === "read_only" ? " (read-only)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
