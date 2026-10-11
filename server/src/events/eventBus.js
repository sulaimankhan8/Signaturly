import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow high number of listeners per event type
    this.setMaxListeners(50);
    this.recorders = [];
  }

  /**
   * Registers a handler that runs, and is awaited, before emitEvent returns.
   * Used for the audit log, so entries are written in the order events happen.
   */
  addRecorder(handlerName, handlerFn) {
    this.recorders.push({ handlerName, handlerFn });
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
        email: actor.email || "",
        ipAddress: actor.ipAddress || "",
        userAgent: actor.userAgent || "",
      },
      payload,
    };

    // On a development machine each event is shown as it happens: its type and the document
    // it is about, never its contents. Production logs stay quiet.
    if (!env.isProd && !env.isTest) {
      console.log(`[EventBus] 📡 ${eventType} for document ${eventEnvelope.aggregateId} (${this.listenerCount(eventType)} listener(s))`);
    }

    for (const { handlerName, handlerFn } of this.recorders) {
      try {
        await handlerFn(eventEnvelope);
      } catch (err) {
        console.error(`[EventBus] Recorder [${handlerName}] failed on [${eventType}]:`, err.message);
      }
    }

    // Everything else (emails, notifications) runs after the request has been answered
    setImmediate(() => {
      this.emit(eventType, eventEnvelope);
      this.emit("*", eventEnvelope);
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
        console.error(`[EventBus] Consumer [${handlerName}] failed processing [${eventType}]:`, err.message);
      }
    });
  }
}

export const eventBus = new EventBus();
