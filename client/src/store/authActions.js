import { setCredentials, logout } from "./authSlice";
import { refreshToken, getMe } from "../api/auth.api";

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
