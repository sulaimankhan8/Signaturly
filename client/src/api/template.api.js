import API from "./axios";

export const fetchMyTemplatesApi = async () => {
  const res = await API.get("/templates");
  return res.data.data;
};

export const fetchPrebuiltTemplatesApi = async () => {
  const res = await API.get("/templates/prebuilt");
  return res.data.data;
};

export const importPrebuiltTemplateApi = async (prebuiltId) => {
  const res = await API.post(`/templates/prebuilt/${prebuiltId}/import`);
  return res.data.data;
};

export const fetchTemplateDetailsApi = async (id) => {
  const res = await API.get(`/templates/${id}`);
  return res.data.data;
};

export const createTemplateApi = async (formData) => {
  const res = await API.post("/templates", formData);
  return res.data.data;
};

export const updateTemplateApi = async (id, payload) => {
  const res = await API.put(`/templates/${id}`, payload);
  return res.data.data;
};

export const deleteTemplateApi = async (id) => {
  const res = await API.delete(`/templates/${id}`);
  return res.data.data;
};

export const useTemplateApi = async (id, payload) => {
  const res = await API.post(`/templates/${id}/use`, payload);
  return res.data.data;
};
