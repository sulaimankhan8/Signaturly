import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow high number of listeners per event type
    this.setMaxListeners(50);
  }

  /**
   * Publishes an event to all registered subscribers.
   * Encapsulates payload inside a standardized envelope.
   */
  async emitEvent(eventType, { aggregateId, actor = {}, payload = {} }) {
    const eventEnvelope = {
      eventId: uuidv4(),
      eventType,
      aggregateId: aggregateId?.toString() || null,
      timestamp: new Date(),
      actor: {
        id: actor.id?.toString() || null,
        name: actor.name || "System",
        email: actor.email || "system@signaturly.com",
        ipAddress: actor.ipAddress || "",
        userAgent: actor.userAgent || "",
      },
      payload,
    };

    console.log(`[EventBus] 📡 Emitting event: [${eventType}] for aggregate: [${eventEnvelope.aggregateId}]`);

    // Emit event asynchronously
    setImmediate(() => {
      this.emit(eventType, eventEnvelope);
      this.emit("*", eventEnvelope); // Global wildcard listener for auditing/monitoring
    });

    return eventEnvelope;
  }

  /**
   * Subscribes a consumer handler with error-handling isolation.
   */
  subscribe(eventType, handlerName, handlerFn) {
    this.on(eventType, async (event) => {
      try {
        await handlerFn(event);
      } catch (err) {
        console.error(`[EventBus] ❌ Consumer [${handlerName}] failed processing [${eventType}] (Event ID: ${event.eventId}):`, err.message);
      }
    });
    console.log(`[EventBus] Registered subscriber: [${handlerName}] -> [${eventType}]`);
  }
}

export const eventBus = new EventBus();
