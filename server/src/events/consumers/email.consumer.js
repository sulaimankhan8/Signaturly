import { eventBus } from "../eventBus.js";
import { EventTypes } from "../eventTypes.js";
import {
  sendSigningRequestEmail,
  sendCompletionEmail,
  sendDeclineEmail,
  sendCancellationNotificationEmail,
  sendReminderEmail,
} from "../../services/email.service.js";

export const registerEmailConsumer = () => {
  // 1. Signature Request Email Consumer
  eventBus.subscribe(EventTypes.DOCUMENT_SENT, "EmailDispatchConsumer", async (event) => {
    const { recipients, pdf, sender, customMessage } = event.payload;
    if (!recipients || !Array.isArray(recipients)) return;

    for (const recipient of recipients) {
      try {
        await sendSigningRequestEmail({
          recipient,
          pdf,
          sender: sender || event.actor,
          customMessage: customMessage || pdf.message,
        });
        console.log(`[EmailConsumer] ✉️ Dispatched signing invite to: ${recipient.email}`);
      } catch (err) {
        console.error(`[EmailConsumer] Failed sending signing invite to ${recipient.email}:`, err.message);
      }
    }
  });

  // 2. Document Completed Email Consumer
  eventBus.subscribe(EventTypes.DOCUMENT_COMPLETED, "EmailCompletionConsumer", async (event) => {
    const { pdf, recipients, downloadUrl } = event.payload;
    if (!recipients || !Array.isArray(recipients)) return;

    for (const r of recipients) {
      try {
        await sendCompletionEmail({
          recipientEmail: r.email,
          recipientName: r.name,
          pdf,
          senderName: "Signaturly Pro Vault",
          downloadUrl,
        });
        console.log(`[EmailConsumer] ✉️ Dispatched completion certificate to: ${r.email}`);
      } catch (err) {
        console.error(`[EmailConsumer] Failed sending completion email to ${r.email}:`, err.message);
      }
    }
  });

  // 3. Document Declined Consumer
  eventBus.subscribe(EventTypes.DOCUMENT_DECLINED, "EmailDeclineConsumer", async (event) => {
    const { senderEmail, pdf, declinedRecipient, reason, priorSigners } = event.payload;

    // Notify document owner
    if (senderEmail) {
      sendDeclineEmail({
        senderEmail,
        pdf,
        declinedRecipient,
        reason,
      }).catch(console.error);
    }

    // Notify prior signers who had already signed
    if (Array.isArray(priorSigners)) {
      for (const priorSigner of priorSigners) {
        sendCancellationNotificationEmail({
          recipientEmail: priorSigner.email,
          recipientName: priorSigner.name,
          pdf,
          eventType: "declined",
          reason: `${declinedRecipient.name} declined: ${reason || 'No reason given'}`,
        }).catch(console.error);
      }
    }
  });

  // 4. Document Voided Consumer
  eventBus.subscribe(EventTypes.DOCUMENT_VOIDED, "EmailVoidConsumer", async (event) => {
    const { pdf, recipients, reason } = event.payload;
    if (!recipients || !Array.isArray(recipients)) return;

    for (const r of recipients) {
      sendCancellationNotificationEmail({
        recipientEmail: r.email,
        recipientName: r.name,
        pdf,
        eventType: "voided",
        reason: reason || "Document was voided and cancelled by the sender.",
      }).catch(console.error);
    }
  });

  // 5. Reminder Dispatched Consumer
  eventBus.subscribe(EventTypes.REMINDER_DISPATCHED, "EmailReminderConsumer", async (event) => {
    const { recipient, pdf, sender, customMessage } = event.payload;
    if (!recipient) return;

    sendReminderEmail({
      recipient,
      pdf,
      sender: sender || event.actor,
      customMessage,
    }).catch(console.error);
  });
};
