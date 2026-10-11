import API from "./axios";

export const fetchApiKeysApi = async () => {
  const res = await API.get("/developer/keys");
  return res.data?.data;
};

export const createApiKeyApi = async (data) => {
  const res = await API.post("/developer/keys", data);
  return res.data?.data;
};

export const revokeApiKeyApi = async (keyId) => {
  const res = await API.delete(`/developer/keys/${keyId}`);
  return res.data?.data;
};

export const fetchWebhooksApi = async () => {
  const res = await API.get("/developer/webhooks");
  return res.data?.data;
};

export const createWebhookApi = async (data) => {
  const res = await API.post("/developer/webhooks", data);
  return res.data?.data;
};

export const deleteWebhookApi = async (webhookId) => {
  const res = await API.delete(`/developer/webhooks/${webhookId}`);
  return res.data?.data;
};

// What was sent to a webhook lately, and sending one of them again
export const fetchWebhookDeliveriesApi = async (webhookId) => {
  const res = await API.get(`/developer/webhooks/${webhookId}/deliveries`);
  return res.data?.data;
};

export const replayWebhookDeliveryApi = async (deliveryId) => {
  const res = await API.post(`/developer/webhooks/deliveries/${deliveryId}/replay`);
  return res.data?.data;
};
