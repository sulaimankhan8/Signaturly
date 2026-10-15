import API from "./axios";

// onProgress(share) is told how much of the file has been sent, from 0 to 1
const withProgress = (onProgress) =>
  onProgress ? { onUploadProgress: (event) => event.total && onProgress(event.loaded / event.total) } : undefined;

export const uploadPdfApi = async (file, onProgress) => {
  const formData = new FormData();
  formData.append("pdf", file);

  const res = await API.post("/pdf/upload", formData, withProgress(onProgress));
  return res.data.data;
};

export const signPdfApi = async (payload) => {
  const res = await API.post("/pdf/sign", payload);
  return res.data.data;
};

export const fetchMyPdfsApi = async () => {
  const res = await API.get("/pdf/my-documents");
  return res.data.data;
};

export const deletePdfApi = async (id) => {
  const res = await API.delete(`/pdf/${id}`);
  return res.data.data;
};

export const fetchPdfAuditApi = async (id) => {
  const res = await API.get(`/pdf/${id}/audit`);
  return res.data.data;
};

// Several PDFs, joined in the order given into one document
export const uploadJoinedPdfsApi = async (files, onProgress) => {
  const formData = new FormData();
  for (const file of files) formData.append("pdfs", file);

  const res = await API.post("/pdf/upload-joined", formData, withProgress(onProgress));
  return res.data.data;
};

// The document as the editor opens it: a link to the file, its page count, and any saved draft
export const fetchDocumentForEditingApi = async (pdfId) => {
  const res = await API.get(`/pdf/${pdfId}`);
  return res.data.data;
};

// Saves the editor's work as the sender goes: { mode, fields, recipients, settings }
export const saveDraftApi = async (pdfId, draft) => {
  const res = await API.put(`/pdf/${pdfId}/draft`, draft);
  return res.data.data;
};
