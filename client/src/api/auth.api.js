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