import axios from "axios";

// Public API instance without Authorization header requirement
const publicAPI = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});

export const fetchSigningSessionApi = async (token) => {
  const res = await publicAPI.get(`/signing/${token}`);
  return res.data.data;
};

export const submitPublicSignatureApi = async (token, fields) => {
  const res = await publicAPI.post(`/signing/${token}/sign`, { fields });
  return res.data.data;
};

export const declinePublicSigningApi = async (token, reason) => {
  const res = await publicAPI.post(`/signing/${token}/decline`, { reason });
  return res.data.data;
};
