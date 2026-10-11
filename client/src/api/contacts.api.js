import API from "./axios";

const data = (res) => res.data?.data;

// Saved lists of people. A list is saved from rows typed in, or from the text of a CSV file.
export const fetchContactListsApi = async () => data(await API.get("/contacts/lists"));
export const fetchContactListApi = async (listId) => data(await API.get(`/contacts/lists/${listId}`));
export const createContactListApi = async (body) => data(await API.post("/contacts/lists", body));
export const updateContactListApi = async (listId, body) => data(await API.put(`/contacts/lists/${listId}`, body));
export const deleteContactListApi = async (listId) => data(await API.delete(`/contacts/lists/${listId}`));

// Sending one template to everyone on a list. The send carries on in the background;
// its progress is read back with fetchBulkBatchApi.
export const fetchBulkBatchesApi = async () => data(await API.get("/contacts/bulk"));
export const startBulkSendApi = async (body) => data(await API.post("/contacts/bulk", body));
export const fetchBulkBatchApi = async (batchId) => data(await API.get(`/contacts/bulk/${batchId}`));
export const retryBulkBatchApi = async (batchId) => data(await API.post(`/contacts/bulk/${batchId}/retry`));
