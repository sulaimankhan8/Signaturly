import API from "./axios";

export const loginApi = async (data) => {
  const res = await API.post("/auth/login", data);
  console.log("Login response:", res.data.data);
  return res.data.data;
};

export const registerApi = async (data) => {
  const res = await API.post("/auth/register", data);
  console.log("Register response:", res.data.data);
  return res.data.data;
};

export const refreshToken = async () => {
  const res = await API.post("/auth/refresh-token");
  return res.data?.data?.accessToken || null;
};

// 👤 Get current user using access token
export const getMe = async (accessToken) => {
  const res = await API.get("/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.data?.data?.user;
};

export const logoutApi = async () => {
  const res = await API.post("/auth/logout");
  return res.data;
};

export const acceptTermsApi = async (token) => {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const res = await API.post("/auth/accept-terms", {}, config);
  return res.data?.data;
};