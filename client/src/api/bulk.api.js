import API from "./axios";

export const bulkSendFromTemplateApi = async (payload) => {
  const res = await API.post("/bulk/send", payload);
  return res.data.data;
};
