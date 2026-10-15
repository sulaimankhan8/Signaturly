import API from "./axios";

export const fetchUserProfileApi = async () => {
  const res = await API.get("/user/profile");
  return res.data.data;
};

export const updateUserProfileApi = async (name) => {
  const res = await API.put("/user/profile", { name });
  return res.data.data;
};

export const changePasswordApi = async ({ currentPassword, newPassword }) => {
  const res = await API.put("/user/password", { currentPassword, newPassword });
  return res.data.data;
};

export const forgotPasswordApi = async (email) => {
  const res = await API.post("/auth/forgot-password", { email });
  return res.data.data;
};

export const resetPasswordApi = async ({ token, newPassword }) => {
  const res = await API.post("/auth/reset-password", { token, newPassword });
  return res.data.data;
};

// The signature and initials kept with the account: { signature, initials } as image data URLs, or null
export const fetchSavedSignatureApi = async () => {
  const res = await API.get("/user/signature");
  return res.data.data;
};

// kind is "signature" or "initials"
export const saveSignatureApi = async (kind, dataUrl) => {
  const res = await API.put("/user/signature", { kind, dataUrl });
  return res.data.data;
};

export const deleteSavedSignatureApi = async (kind) => {
  const res = await API.delete("/user/signature", { params: { kind } });
  return res.data.data;
};
