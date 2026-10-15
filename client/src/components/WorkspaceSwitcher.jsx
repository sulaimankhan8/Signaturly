import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadWorkspaces } from "../store/workspaceActions";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "../utils/workspace";

/**
 * Chooses which workspace the person is working in: their own documents or a team's.
 * Shown only to someone who belongs to more than one. Changing it reloads the page, so every
 * list on screen is read again for the workspace chosen.
 *
 * The list comes from the store, where it is remembered between pages and reloads
 * (store/workspacesSlice.js), so the switcher is drawn with the navbar rather than popping in.
 */
export default function WorkspaceSwitcher({ className = "" }) {
  const dispatch = useDispatch();
  const signedIn = useSelector((state) => Boolean(state.auth.accessToken));
  const { list: workspaces, loaded } = useSelector((state) => state.workspaces);

  useEffect(() => {
    if (signedIn) dispatch(loadWorkspaces()).catch(() => {});
  }, [signedIn, dispatch]);

  // A remembered workspace the person has since left: go back to their own documents, as the
  // server already does. Only once the list has been read again, not from what this device remembered.
  useEffect(() => {
    const remembered = getActiveWorkspaceId();
    if (loaded && remembered && !workspaces.some((w) => w.id === remembered)) setActiveWorkspaceId("");
  }, [loaded, workspaces]);

  if (workspaces.length < 2) return null;

  const personal = workspaces.find((w) => w.personal);
  const active = getActiveWorkspaceId();
  const value = active && workspaces.some((w) => w.id === active) ? active : personal?.id || "";

  const change = (event) => {
    const chosen = workspaces.find((w) => w.id === event.target.value);
    setActiveWorkspaceId(chosen && !chosen.personal ? chosen.id : "");
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
          <option key={workspace.id} value={workspace.id}>
            {workspace.personal ? "My documents" : workspace.name}
            {workspace.status === "read_only" ? " (read-only)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
