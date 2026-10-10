import mongoose from "mongoose";
import { eventBus } from "../eventBus.js";
import { EventTypes } from "../eventTypes.js";
import { appendAuditEvent } from "../../services/auditLedger.service.js";

const EVENT_NAMES = {
  [EventTypes.DOCUMENT_CREATED]: "created",
  [EventTypes.DOCUMENT_SENT]: "sent",
  [EventTypes.RECIPIENT_VIEWED]: "viewed",
  [EventTypes.DOCUMENT_COMPLETED]: "completed",
  [EventTypes.DOCUMENT_DECLINED]: "declined",
  [EventTypes.DOCUMENT_VOIDED]: "voided",
  [EventTypes.DOCUMENT_EXPIRED]: "expired",
  [EventTypes.REMINDER_DISPATCHED]: "reminder_sent",
  [EventTypes.RECIPIENT_EMAIL_UPDATED]: "recipient_updated",
};

const describe = (event) => {
  const who = event.actor.name;
  switch (event.eventType) {
    case EventTypes.DOCUMENT_CREATED:
      return "Document uploaded.";
    case EventTypes.DOCUMENT_SENT:
      return `Sent for signature to ${event.payload?.recipients?.length || event.payload?.recipientsCount || 1} recipient(s).`;
    case EventTypes.RECIPIENT_VIEWED:
      return `${who} opened the signing link.`;
    case EventTypes.DOCUMENT_COMPLETED:
      return "All parties signed. Document completed.";
    case EventTypes.DOCUMENT_DECLINED:
      return `${who} declined to sign. Reason: "${event.payload?.reason || "No reason given"}".`;
    case EventTypes.DOCUMENT_VOIDED:
      return `Document voided by ${who}.`;
    case EventTypes.DOCUMENT_EXPIRED:
      return "Signing deadline passed. Document expired.";
    case EventTypes.REMINDER_DISPATCHED:
      return `Reminder sent to ${event.payload?.recipientName || "recipient"}.`;
    case EventTypes.RECIPIENT_EMAIL_UPDATED:
      return `Signer email changed to ${event.payload?.newEmail}. A new signing link was issued.`;
    default:
      return `Event ${event.eventType}.`;
  }
};

const asObjectId = (id) => (id && mongoose.Types.ObjectId.isValid(String(id)) ? id : null);

/**
 * Writes every domain event into the hash-chained audit log, in order.
 * Signatures are the one exception: they are recorded where the file is stamped,
 * because that is where the before and after hashes are known.
 */
export const registerAuditConsumer = () => {
  eventBus.addRecorder("AuditLog", async (event) => {
    const auditEvent = EVENT_NAMES[event.eventType];
    if (!auditEvent || !event.aggregateId) return;

    // For these two events the actor is the signer, not an account holder
    const actorIsRecipient = [EventTypes.RECIPIENT_VIEWED, EventTypes.DOCUMENT_DECLINED].includes(event.eventType);

    await appendAuditEvent({
      pdfId: event.aggregateId,
      recipientId: asObjectId(
        actorIsRecipient ? event.actor?.id : event.payload?.recipientId || event.payload?.recipient?._id
      ),
      userId: actorIsRecipient ? null : asObjectId(event.actor?.id),
      event: auditEvent,
      actorName: event.actor.name,
      actorEmail: event.actor.email,
      description: describe(event),
      ipAddress: event.actor.ipAddress,
      userAgent: event.actor.userAgent,
      signedAt: event.timestamp,
    });
  });
};
