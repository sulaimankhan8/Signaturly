import { registerAuditConsumer } from "./consumers/audit.consumer.js";
import { registerEmailConsumer } from "./consumers/email.consumer.js";

export const initEventSystem = () => {
  console.log("[EventBus] 🚀 Initializing Event-Driven Architecture subsystems...");
  registerAuditConsumer();
  registerEmailConsumer();
  console.log("[EventBus] ✅ All event consumers successfully registered.");
};

export { eventBus } from "./eventBus.js";
export { EventTypes } from "./eventTypes.js";
