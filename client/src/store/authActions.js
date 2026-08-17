import { setCredentials, logout } from "./authSlice";
import { refreshToken, getMe, logoutApi } from "../api/auth.api";

// 🔄 Runs on app load to restore session
export const hydrateAuth = () => async (dispatch) => {
  try {
    const accessToken = await refreshToken();

    if (!accessToken) {
      dispatch(logout());
      return;
    }

    const user = await getMe(accessToken);

    dispatch(
      setCredentials({
        user,
        accessToken,
      })
    );
  } catch (err) {
    console.error("❌ Auth hydration failed:", err);
    dispatch(logout());
  }
};

// 🚪 Full logout: clears server-side HTTP-only cookie and Redux state
export const performLogout = () => async (dispatch) => {
  try {
    await logoutApi();
  } catch (err) {
    console.warn("Logout API warning:", err);
  } finally {
    dispatch(logout());
  }
};

