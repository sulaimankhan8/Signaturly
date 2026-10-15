import { workspacesLoaded } from "./workspacesSlice";
import { fetchWorkspacesApi } from "../api/workspace.api";

// One request at a time, however many screens ask together
let pending = null;

/**
 * Reads the person's workspaces from the server, once a session unless `force` (after something
 * changed them: a team made, joined or left). Resolves with the full list as the server gives it,
 * logos and all; the store keeps only what the switcher shows.
 */
export const loadWorkspaces =
  ({ force = false } = {}) =>
  (dispatch, getState) => {
    if (!force && getState().workspaces.loaded) return Promise.resolve(getState().workspaces.list);
    if (!pending) {
      pending = fetchWorkspacesApi()
        .then((list) => {
          if (Array.isArray(list)) dispatch(workspacesLoaded(list));
          return list || [];
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
