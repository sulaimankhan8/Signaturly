import mongoose from "mongoose";
import { eventBus } from "../eventBus.js";
import { EventTypes } from "../eventTypes.js";
import { PdfAudit } from "../../models/PdfAudit.model.js";

export const registerAuditConsumer = () => {
  eventBus.subscribe("*", "AuditLogConsumer", async (event) => {
    try {
      if (!event.aggregateId) return;

      const eventTypeEnumMap = {
        [EventTypes.DOCUMENT_CREATED]: "created",
        [EventTypes.DOCUMENT_SENT]: "sent",
        [EventTypes.RECIPIENT_VIEWED]: "viewed",
        [EventTypes.DOCUMENT_SIGNED]: "signed",
        [EventTypes.DOCUMENT_COMPLETED]: "completed",
        [EventTypes.DOCUMENT_DECLINED]: "declined",
        [EventTypes.DOCUMENT_VOIDED]: "voided",
        [EventTypes.DOCUMENT_EXPIRED]: "expired",
        [EventTypes.REMINDER_DISPATCHED]: "reminder_sent",
        [EventTypes.RECIPIENT_EMAIL_UPDATED]: "recipient_updated",
      };

      const auditEvent = eventTypeEnumMap[event.eventType] || "signed";

      const descriptionMap = {
        [EventTypes.DOCUMENT_CREATED]: "Document created and uploaded to vault.",
        [EventTypes.DOCUMENT_SENT]: `Document dispatched to ${event.payload?.recipientsCount || 1} authorized recipient(s).`,
        [EventTypes.RECIPIENT_VIEWED]: `${event.actor.name} opened and reviewed the document.`,
        [EventTypes.DOCUMENT_SIGNED]: `${event.actor.name} completed and placed legal e-signature.`,
        [EventTypes.DOCUMENT_COMPLETED]: "All parties executed the agreement. Document sealed with Merkle audit certificate.",
        [EventTypes.DOCUMENT_DECLINED]: `${event.actor.name} declined to sign. Reason: "${event.payload?.reason || 'No reason specified'}".`,
        [EventTypes.DOCUMENT_VOIDED]: `Document voided and cancelled by ${event.actor.name}.`,
        [EventTypes.DOCUMENT_EXPIRED]: "Document marked expired as signing deadline elapsed.",
        [EventTypes.REMINDER_DISPATCHED]: `Reminder dispatched to ${event.payload?.recipientName || 'recipient'}.`,
        [EventTypes.RECIPIENT_EMAIL_UPDATED]: `Signer email updated to ${event.payload?.newEmail}. New signing token issued.`,
      };

      const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

      await PdfAudit.create({
        pdfId: event.aggregateId,
        recipientId: isValidObjectId(event.payload?.recipientId) ? event.payload.recipientId : null,
        userId: isValidObjectId(event.actor?.id) ? event.actor.id : null,
        event: auditEvent,
        actorName: event.actor.name,
        actorEmail: event.actor.email,
        description: descriptionMap[event.eventType] || `Event [${event.eventType}] occurred.`,
        ipAddress: event.actor.ipAddress,
        userAgent: event.actor.userAgent,
        signedAt: event.timestamp,
      });

      console.log(`[AuditConsumer] 📋 Logged audit event [${auditEvent}] for document [${event.aggregateId}]`);
    } catch (err) {
      console.error("[AuditConsumer] Failed to write audit record:", err.message);
    }
  });
};
