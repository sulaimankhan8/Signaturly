import axios from "axios";
import { store } from "../store/store";
import { setCredentials, logout } from "../store/authSlice";
import { getActiveWorkspaceId } from "../utils/workspace";
import { OUT_OF_DOCUMENTS, isOutOfDocuments } from "../utils/outOfDocuments";

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});


API.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // The workspace the person is working in; the server checks they belong to it
  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) {
    config.headers["X-Workspace-Id"] = workspaceId;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Do not attempt token refresh for auth endpoints themselves
    if (
      err.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh-token")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return API(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await API.post("/auth/refresh-token");
        const newToken = res.data?.data?.accessToken;

        if (!newToken) {
          throw new Error("No access token returned");
        }

        const currentUser = store.getState().auth.user;
        store.dispatch(setCredentials({ accessToken: newToken, user: currentUser }));
        API.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return API(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        store.dispatch(logout());
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Out of documents: said once here, so every screen that sends offers the same way forward.
    // The screen still gets the error and shows it as it always has.
    if (isOutOfDocuments(err)) window.dispatchEvent(new CustomEvent(OUT_OF_DOCUMENTS));

    return Promise.reject(err);
  }
);

export default API;
