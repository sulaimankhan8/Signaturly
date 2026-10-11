import API from "./axios";

export const sendDocumentApi = async (pdfId, payload) => {
  const res = await API.post(`/send/${pdfId}`, payload);
  return res.data.data;
};

export const fetchDocumentDetailsApi = async (pdfId) => {
  const res = await API.get(`/send/${pdfId}`);
  return res.data.data;
};

export const voidDocumentApi = async (pdfId) => {
  const res = await API.post(`/send/${pdfId}/void`);
  return res.data.data;
};

export const remindRecipientApi = async (recipientId, payload = {}) => {
  const res = await API.post(`/send/recipients/${recipientId}/remind`, payload);
  return res.data.data;
};

// Moves a signer from Aadhaar eSign back to ordinary signing
export const useOrdinarySigningApi = async (recipientId) => {
  const res = await API.post(`/esign/recipients/${recipientId}/use-ordinary-signing`);
  return res.data?.data;
};

// Whether Aadhaar eSign can be chosen, and what one signature costs
export const fetchEsignAvailabilityForSenderApi = async () => {
  const res = await API.get("/esign/availability");
  return res.data?.data;
};
