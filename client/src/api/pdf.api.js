import API from "./axios";

export const uploadPdfApi = async (file) => {
  const formData = new FormData();
  formData.append("pdf", file);

  const res = await API.post("/pdf/upload", formData);
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
export const uploadJoinedPdfsApi = async (files) => {
  const formData = new FormData();
  for (const file of files) formData.append("pdfs", file);

  const res = await API.post("/pdf/upload-joined", formData);
  return res.data.data;
};
