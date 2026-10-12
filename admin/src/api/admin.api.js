import axios from "axios";
import { getToken, endSession } from "../auth/session.js";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
// Normalize base URL so it points to /api
const baseURL = rawBaseUrl.endsWith("/api")
  ? rawBaseUrl
  : rawBaseUrl
  ? `${rawBaseUrl.replace(/\/+$/, "")}/api`
  : "/api";

export const adminApi = axios.create({
  baseURL,
  withCredentials: true,
});

// The admin token travels in a header, never in the address bar
adminApi.interceptors.request.use((config) => {
  const adminToken = getToken();
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

// A session the server no longer accepts ends here, once, for every screen
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const said = String(error.response?.data?.error || "");
    const signingIn = String(error.config?.url || "").includes("/admin/login");
    if (!signingIn && (status === 401 || (status === 403 && said.startsWith("ACCESS_DENIED")))) {
      endSession("ended");
    }
    return Promise.reject(error);
  }
);

/**
 * What to tell the operator when a request fails. A server that cannot be reached is said
 * to be unreachable; it is never described as a refusal.
 */
export const errorText = (error, fallback = "That did not work. Try again.") => {
  if (axios.isCancel(error)) return "";
  if (!error.response) return "The server cannot be reached. Check the connection and try again.";
  if (error.response.status === 429) return "Too many tries. Wait a few minutes, then try again.";
  const data = error.response.data;
  const text = (typeof data === "object" && data && (data.message || data.error)) || fallback;
  // "CODE_NAME: sentence" is how the server labels some refusals; people read the sentence
  return String(text).replace(/^[A-Z0-9_]+:\s*/, "");
};

// The server's label for a refusal ("TWO_FACTOR_CODE_NEEDED"), when it gave one
export const errorCode = (error) => {
  const data = error.response?.data;
  const text = String((typeof data === "object" && data && (data.message || data.error)) || "");
  return /^([A-Z0-9_]+):/.exec(text)?.[1] || "";
};

// Fetches a file with the admin token and hands it to the browser to save
export const downloadFile = async (path, filename) => {
  const res = await adminApi.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
