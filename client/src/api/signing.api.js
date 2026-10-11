import axios from "axios";

// Public API instance without Authorization header requirement
const publicAPI = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});

// `embed` is the session a customer's website opened the page with, when it shows it in a frame
export const fetchSigningSessionApi = async (token, embed) => {
  const res = await publicAPI.get(`/signing/${token}`, embed ? { params: { embed } } : undefined);
  return res.data.data;
};

// `consent` records that the signer ticked the electronic-signature consent box
export const submitPublicSignatureApi = async (token, fields, consent = false, consentVersion) => {
  const res = await publicAPI.post(`/signing/${token}/sign`, { fields, consent, consentVersion });
  return res.data.data;
};

export const declinePublicSigningApi = async (token, reason) => {
  const res = await publicAPI.post(`/signing/${token}/decline`, { reason });
  return res.data.data;
};

// Aadhaar eSign: the signer agrees and is sent to the provider, then comes back
export const fetchEsignAvailabilityApi = async () => {
  const res = await publicAPI.get("/esign/availability");
  return res.data?.data;
};

export const startEsignApi = async (token, payload) => {
  const res = await publicAPI.post(`/esign/${token}/start`, payload);
  return res.data?.data;
};

export const completeEsignApi = async (token, transactionId) => {
  const res = await publicAPI.post(`/esign/${token}/complete`, { transactionId });
  return res.data?.data;
};

// Development only: what the person chose on the stand-in provider's page
export const reportEsignStandInApi = async (transactionId, payload) => {
  const res = await publicAPI.post(`/esign/stand-in/${transactionId}`, payload);
  return res.data?.data;
};
