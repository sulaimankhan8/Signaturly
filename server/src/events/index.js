import { registerAuditConsumer } from "./consumers/audit.consumer.js";
import { registerEmailConsumer } from "./consumers/email.consumer.js";
import { registerJobHandlers } from "../jobs/handlers.js";
import { registerBulkJobHandlers } from "../services/contactList.service.js";
import { registerWebhookDelivery } from "../services/webhookDelivery.service.js";
import { registerDeployHook } from "../services/deployHook.service.js";

export const initEventSystem = () => {
  registerDeployHook();
  registerAuditConsumer();
  registerEmailConsumer();
  registerJobHandlers();
  registerBulkJobHandlers();
  registerWebhookDelivery();
};

export { eventBus } from "./eventBus.js";
export { EventTypes } from "./eventTypes.js";
