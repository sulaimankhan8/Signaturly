import API from "./axios";

// Ready-made templates that are filled in by answering questions

export const fetchCatalogueApi = async () => (await API.get("/catalogue")).data.data;

export const fetchEntitlementsApi = async () => (await API.get("/catalogue/entitlements")).data.data;

export const fetchCatalogueTemplateApi = async (key) => (await API.get(`/catalogue/${key}`)).data.data;

/**
 * The document as it would be sent with the answers so far.
 * Returns the PDF and the ids of the questions still unanswered.
 */
export const previewCatalogueTemplateApi = async (key, answers, today, signal) => {
  const res = await API.post(`/catalogue/${key}/preview`, { answers, today }, { responseType: "blob", signal });
  const unanswered = res.headers["x-unanswered"] || "";
  return {
    blob: res.data,
    pageCount: Number(res.headers["x-page-count"]) || 1,
    unanswered: unanswered ? unanswered.split(",") : [],
  };
};

export const saveCatalogueDraftApi = async (key, answers, signers) =>
  (await API.put(`/catalogue/${key}/draft`, { answers, signers })).data.data;

export const deleteCatalogueDraftApi = async (key) => (await API.delete(`/catalogue/${key}/draft`)).data.data;

export const sendFromCatalogueApi = async (key, payload) => (await API.post(`/catalogue/${key}/send`, payload)).data.data;
