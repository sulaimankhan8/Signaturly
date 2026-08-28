import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  accessToken: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
    },
    setTermsAccepted(state, action) {
      if (state.user) {
        state.user.termsAccepted = true;
        state.user.termsAcceptedAt = action.payload?.termsAcceptedAt || new Date().toISOString();
      }
    },
  },
});

export const { setCredentials, logout, setTermsAccepted } = authSlice.actions;
export default authSlice.reducer;
