import axios from "axios";

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

adminApi.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("signaturly_admin_token");
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

export const getAdminBaseUrl = () => baseURL;
