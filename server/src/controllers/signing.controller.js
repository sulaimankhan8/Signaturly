import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getRecipientByToken,
  recordRecipientView,
  submitRecipientSignature,
  declineRecipientSignature,
} from "../services/recipient.service.js";
import path from "path";
import fs from "fs";

export const getPublicSigningSessionController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { recipient, pdf } = await recordRecipientView({
    token,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  const fileName = path.basename(pdf.storagePath);
  const signedFileName = fileName.replace(/\.pdf$/i, "-signed.pdf");
  const signedPath = pdf.storagePath.replace(/\.pdf$/i, "-signed.pdf");
  const currentFile = fs.existsSync(signedPath) ? signedFileName : fileName;

  const pdfUrl = `/uploads/${pdf.userId}/${currentFile}`;

  res.status(200).json(
    new ApiResponse(
      {
        recipient: {
          id: recipient._id,
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          color: recipient.color,
          status: recipient.status,
          token: recipient.token,
          authType: recipient.authType || "none",
          authVerified: Boolean(recipient.authVerified),
        },
        document: {
          id: pdf._id,
          originalFileName: pdf.originalFileName,
          pageCount: pdf.pageCount,
          status: pdf.status,
          pdfUrl,
          fields: pdf.fields || [],
          message: pdf.message,
          expiresAt: pdf.expiresAt,
        },
      },
      "Signing session loaded"
    )
  );
});

export const submitPublicSignatureController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { fields } = req.body;

  const result = await submitRecipientSignature({
    token,
    filledFields: fields,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Signature recorded and document updated successfully"));
});

export const declinePublicSigningController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { reason } = req.body;

  const result = await declineRecipientSignature({
    token,
    reason,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Document declined"));
});
