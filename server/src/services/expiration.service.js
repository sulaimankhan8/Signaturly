import { Pdf } from "../models/Pdf.model.js";
import { eventBus, EventTypes } from "../events/index.js";

// Automated document expiration runner
export const processAutomatedExpirations = async () => {
  try {
    const now = new Date();

    const expiredPdfs = await Pdf.find({
      status: { $in: ["pending", "partially_signed"] },
      expiresAt: { $ne: null, $lt: now },
    });

    for (const pdf of expiredPdfs) {
      pdf.status = "expired";
      await pdf.save();

      await eventBus.emitEvent(EventTypes.DOCUMENT_EXPIRED, {
        aggregateId: pdf._id,
        actor: {
          id: pdf.userId,
          name: "Signaturly Automation",
          email: "system@signaturly.com",
        },
        payload: {
          pdf,
          deadline: pdf.expiresAt,
        },
      });

      console.log(`[EventBus] Document ${pdf._id} (${pdf.originalFileName}) marked as expired.`);
    }
  } catch (error) {
    console.error("Error processing document expirations:", error);
  }
};
