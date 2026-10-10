import { eventBus } from "../eventBus.js";
import { EventTypes } from "../eventTypes.js";
import { enqueueJob } from "../../jobs/queue.js";

const idOf = (doc) => (doc?._id || doc)?.toString();

/**
 * Turns domain events into queued email jobs. Each job is saved before it is attempted,
 * retried with back-off when the mail server fails, and keyed so the same event cannot
 * send the same email twice.
 */
export const registerEmailConsumer = () => {
  // 1. Signature request, including the next signer in a sequence
  eventBus.subscribe(EventTypes.DOCUMENT_SENT, "EmailDispatchConsumer", async (event) => {
    const { recipients, customMessage } = event.payload;
    if (!Array.isArray(recipients)) return;

    for (const recipient of recipients) {
      await enqueueJob(
        "email.signing_request",
        { recipientId: idOf(recipient), customMessage },
        { idempotencyKey: `invite:${event.eventId}:${idOf(recipient)}` }
      );
    }
  });

  // 2. Completion: every recipient, and the owner
  eventBus.subscribe(EventTypes.DOCUMENT_COMPLETED, "EmailCompletionConsumer", async (event) => {
    const { pdf, recipients } = event.payload;

    for (const recipient of Array.isArray(recipients) ? recipients : []) {
      await enqueueJob(
        "email.completion",
        { recipientId: idOf(recipient) },
        { idempotencyKey: `completed:${idOf(pdf)}:${idOf(recipient)}` }
      );
    }
    await enqueueJob(
      "email.completion_owner",
      { pdfId: idOf(pdf) },
      { idempotencyKey: `completed-owner:${idOf(pdf)}` }
    );
  });

  // 3. Declined: tell the owner, and anyone who had already signed
  eventBus.subscribe(EventTypes.DOCUMENT_DECLINED, "EmailDeclineConsumer", async (event) => {
    const { pdf, declinedRecipient, reason, priorSigners } = event.payload;

    await enqueueJob(
      "email.decline",
      { pdfId: idOf(pdf), recipientId: idOf(declinedRecipient), reason },
      { idempotencyKey: `declined:${idOf(pdf)}` }
    );

    for (const signer of Array.isArray(priorSigners) ? priorSigners : []) {
      await enqueueJob(
        "email.cancellation",
        {
          recipientId: idOf(signer),
          eventType: "declined",
          reason: `${declinedRecipient?.name || "A signer"} declined: ${reason || "No reason given"}`,
        },
        { idempotencyKey: `declined-notice:${idOf(pdf)}:${idOf(signer)}` }
      );
    }
  });

  // 4. Voided by the sender
  eventBus.subscribe(EventTypes.DOCUMENT_VOIDED, "EmailVoidConsumer", async (event) => {
    const { pdf, recipients, reason } = event.payload;

    for (const recipient of Array.isArray(recipients) ? recipients : []) {
      await enqueueJob(
        "email.cancellation",
        {
          recipientId: idOf(recipient),
          eventType: "voided",
          reason: reason || "Document was voided and cancelled by the sender.",
        },
        { idempotencyKey: `voided:${idOf(pdf)}:${idOf(recipient)}` }
      );
    }
  });

  // 4b. Signer email corrected: the new address needs its own invitation
  eventBus.subscribe(EventTypes.RECIPIENT_EMAIL_UPDATED, "EmailRecipientUpdatedConsumer", async (event) => {
    const { recipient } = event.payload;
    if (!recipient) return;

    await enqueueJob(
      "email.signing_request",
      { recipientId: idOf(recipient) },
      { idempotencyKey: `invite:${event.eventId}:${idOf(recipient)}` }
    );
  });

  // 5. Reminder
  eventBus.subscribe(EventTypes.REMINDER_DISPATCHED, "EmailReminderConsumer", async (event) => {
    const { recipient, customMessage } = event.payload;
    if (!recipient) return;

    await enqueueJob(
      "email.reminder",
      { recipientId: idOf(recipient), customMessage },
      { idempotencyKey: `reminder:${event.eventId}:${idOf(recipient)}` }
    );
  });
};
