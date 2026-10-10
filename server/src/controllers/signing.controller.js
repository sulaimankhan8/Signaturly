import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  recordRecipientView,
  submitRecipientSignature,
  declineRecipientSignature,
  isRecipientVerified,
  CONSENT_VERSION,
} from "../services/recipient.service.js";
import { getFileUrl } from "../services/storage.service.js";
import { currentKeyOf, downloadKeyOf } from "../services/documentFiles.service.js";
import { maskPhone } from "../services/messaging/index.js";

const maskEmail = (email = "") => {
  const [local, domain] = String(email).split("@");
  if (!domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
};

export const getPublicSigningSessionController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { recipient, pdf } = await recordRecipientView({
    token,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  // Until the signer passes the check the sender asked for, reveal nothing about the document's content
  if (!isRecipientVerified(recipient)) {
    return res.status(200).json(
      new ApiResponse(
        {
          recipient: {
            name: recipient.name,
            email: recipient.email ? maskEmail(recipient.email) : maskPhone(recipient.phone),
            language: recipient.language || "en",
            channel: recipient.channel || "email",
            status: recipient.status,
            authType: recipient.authType,
            authVerified: false,
          },
          document: {
            originalFileName: pdf.originalFileName,
            pageCount: pdf.pageCount,
            status: pdf.status,
            pdfUrl: null,
            fields: [],
          },
          verificationRequired: true,
        },
        "Identity verification required"
      )
    );
  }

  // While signing is in progress the signer sees the latest signed version;
  // once everyone has signed, they get the sealed copy with its signing record.
  const key = pdf.status === "signed" ? await downloadKeyOf(pdf) : await currentKeyOf(pdf);

  // A short-lived link for this signer only
  const pdfUrl = await getFileUrl(key);

  res.status(200).json(
    new ApiResponse(
      {
        recipient: {
          id: recipient._id,
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone ? maskPhone(recipient.phone) : "",
          language: recipient.language || "en",
          channel: recipient.channel || "email",
          role: recipient.role,
          color: recipient.color,
          status: recipient.status,
          signedAt: recipient.signedAt || null,
          authType: recipient.authType || "none",
          authVerified: true,
        },
        document: {
          id: pdf._id,
          originalFileName: pdf.originalFileName,
          pageCount: pdf.pageCount,
          status: pdf.status,
          isSealed: Boolean(pdf.sealedKey),
          pdfUrl,
          fields: pdf.fields || [],
          message: pdf.message,
          expiresAt: pdf.expiresAt,
        },
        consentVersion: CONSENT_VERSION,
        monetization: {
          showAds: false,
        },
      },
      "Signing session loaded"
    )
  );
});

export const submitPublicSignatureController = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { fields, consent, consentVersion } = req.body;

  const result = await submitRecipientSignature({
    token,
    filledFields: fields,
    consent,
    consentVersion,
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
