import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import workspacesReducer, { rememberWorkspaces } from "./workspacesSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspaces: workspacesReducer,
  },
});

// The workspace list is remembered on this device whenever it changes (store/workspacesSlice.js)
let rememberedList = store.getState().workspaces.list;
store.subscribe(() => {
  const { list } = store.getState().workspaces;
  if (list === rememberedList) return;
  rememberedList = list;
  rememberWorkspaces(list);
});
