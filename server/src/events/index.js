import { registerAuditConsumer } from "./consumers/audit.consumer.js";
import { registerEmailConsumer } from "./consumers/email.consumer.js";
import { registerJobHandlers } from "../jobs/handlers.js";

export const initEventSystem = () => {
  registerAuditConsumer();
  registerEmailConsumer();
  registerJobHandlers();
};

export { eventBus } from "./eventBus.js";
export { EventTypes } from "./eventTypes.js";
