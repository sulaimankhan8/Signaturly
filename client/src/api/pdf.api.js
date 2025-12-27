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
