import { createSlice } from "@reduxjs/toolkit";
import { logout } from "./authSlice";

/**
 * The workspaces the signed-in person belongs to, read once a session and shared by every screen
 * (store/workspaceActions.js). The last list is remembered on this device, so the navbar's
 * switcher is in place from the first paint instead of appearing a moment later and pushing the
 * navbar about. Only what the switcher shows is kept: no logos, which can be large. Signing out
 * forgets it.
 */

const KEY = "pactdoc.workspaces";

const slim = (workspace) => ({
  id: String(workspace.id),
  name: workspace.name,
  personal: Boolean(workspace.personal),
  status: workspace.status,
  role: workspace.role,
});

const remembered = () => {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || "null");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// Called by the store whenever the list changes (store/store.js)
export const rememberWorkspaces = (list) => {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private browsing may refuse storage; the switcher then appears once the list is read
  }
};

const workspacesSlice = createSlice({
  name: "workspaces",
  // `loaded`: read from the server in this session, not just remembered
  initialState: () => ({ list: remembered(), loaded: false }),
  reducers: {
    workspacesLoaded(state, action) {
      state.list = action.payload.map(slim);
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => ({ list: [], loaded: false }));
  },
});

export const { workspacesLoaded } = workspacesSlice.actions;
export default workspacesSlice.reducer;
