import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";

// Automated document expiration runner
export const processAutomatedExpirations = async () => {
  try {
    const now = new Date();

    const expiredPdfs = await Pdf.find({
      status: "pending",
      expiresAt: { $ne: null, $lt: now },
    });

    for (const pdf of expiredPdfs) {
      pdf.status = "expired";
      await pdf.save();

      await PdfAudit.create({
        pdfId: pdf._id,
        userId: pdf.userId,
        event: "expired",
        actorName: "Signaturly Automation",
        actorEmail: "system@signaturly.com",
        description: `Document marked expired as deadline (${new Date(pdf.expiresAt).toLocaleDateString()}) was reached.`,
        signedAt: new Date(),
      });

      console.log(`Document ${pdf._id} (${pdf.originalFileName}) marked as expired.`);
    }
  } catch (error) {
    console.error("Error processing document expirations:", error);
  }
};
