import fs from "fs";
import path from "path";
import axios from "axios";
import { PDFDocument, rgb } from "pdf-lib";
import { percentToPdfCoords } from "./coordinate.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { ApiError } from "../utils/ApiError.js";

export const signPdf = async ({ pdfId, userId, fields }) => {
  console.log("signPdf called", { pdfId, userId, fieldsCount: fields?.length });
  
  const pdfMeta = await Pdf.findById(pdfId);
  console.log("pdfMeta lookup result", { pdfId, found: !!pdfMeta });
  if (!pdfMeta) throw new ApiError(404, "PDF not found");
  if (pdfMeta.userId.toString() !== userId)
    {
      console.error("signPdf authorization failed", { expectedUserId: pdfMeta.userId?.toString(), userId });
      throw new ApiError(403, "Not your document");
    }

  // Check if file exists
  if (!fs.existsSync(pdfMeta.storagePath)) {
    throw new ApiError(404, "PDF file not found on disk");
  }

  const originalBuffer = fs.readFileSync(pdfMeta.storagePath);
  const originalHash = sha256FromBuffer(originalBuffer);
  console.log("original file read", { storagePath: pdfMeta.storagePath, originalHash });

  const pdfDoc = await PDFDocument.load(originalBuffer);
  console.log("PDF loaded with", pdfDoc.getPageCount(), "pages");

  // Process each field
  for (const field of fields) {
    console.log("Processing field:", field.type, field.id);
    
    // Get the page (0-indexed)
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
      console.error("Invalid page number:", field.page);
      continue;
    }
    
    const page = pdfDoc.getPage(pageIndex);
    const { width: pw, height: ph } = page.getSize();
    
    // Clamp values to prevent errors
    const safeField = {
      ...field,
      xPercent: Math.max(0, Math.min(1, field.xPercent)),
      yPercent: Math.max(0, Math.min(1, field.yPercent)),
      widthPercent: Math.max(0.01, Math.min(1, field.widthPercent)),
      heightPercent: Math.max(0.01, Math.min(1, field.heightPercent)),
    };

    // Convert percentages to PDF coordinates
    const { x, y, width, height } = percentToPdfCoords({
      ...safeField,
      pdfWidth: pw,
      pdfHeight: ph,
    });

    console.log("Field coordinates:", { 
      type: field.type, 
      x, y, width, height, 
      pageWidth: pw, 
      pageHeight: ph 
    });

    // Handle different field types
    switch (field.type) {
      case "text": {
  const fontSize =
    field.fontSizePercent
      ? field.fontSizePercent * ph
      : height * 0.6;

  page.drawText(field.value || "", {
    x,
    y: y + height / 2 - fontSize / 3,
    size: Math.max(8, fontSize),
    color: rgb(0, 0, 0),
  });
  break;
}


      case "date": {
  const fontSize =
    field.fontSizePercent
      ? field.fontSizePercent * ph
      : height * 0.6;

  page.drawText(field.value || new Date().toLocaleDateString(), {
    x,
    y: y + height / 2 - fontSize / 3,
    size: Math.max(8, fontSize),
    color: rgb(0, 0, 0),
  });
  break;
}


      case "signature":
        if (!field.signatureUrl) {
          console.warn("Signature field without URL:", field.id);
          break;
        }

        try {
          // Fetch the signature image
          console.log("Fetching signature from:", field.signatureUrl);
          const imgRes = await axios.get(field.signatureUrl, {
            responseType: "arraybuffer",
            timeout: 10000, // Add timeout
          });

          // Embed the image
          const image = await pdfDoc.embedPng(imgRes.data);
          const imgDims = image.scale(1);

          // Calculate scale to fit within the field while maintaining aspect ratio
          const scale = Math.min(
            width / imgDims.width,
            height / imgDims.height
          );

          const drawW = imgDims.width * scale;
          const drawH = imgDims.height * scale;

          // Center the image within the field
          page.drawImage(image, {
            x: x + (width - drawW) / 2,
            y: y + (height - drawH) / 2,
            width: drawW,
            height: drawH,
          });

          console.log("Signature embedded:", { drawW, drawH });
        } catch (imgError) {
          console.error("Error embedding signature:", imgError);
          // Continue with other fields even if this one fails
        }
        break;

      case "radio": {
  const size =
    field.fontSizePercent
      ? field.fontSizePercent * ph
      : Math.min(width, height) * 0.6;

  const radius = size / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    borderWidth: 1,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
  });

  if (field.checked) {
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius * 0.6,
      color: rgb(0, 0, 0),
    });
  }
  break;
}

      default:
        console.warn("Unknown field type:", field.type);
    }
  }

  // Save the signed PDF
  const signedBytes = await pdfDoc.save();
  const signedHash = sha256FromBuffer(signedBytes);

  console.log("signed PDF generated", { signedBytesLength: signedBytes?.length, signedHash });

  const signedPath = pdfMeta.storagePath.replace(
    ".pdf",
    "-signed.pdf"
  );

  fs.writeFileSync(signedPath, signedBytes);
  console.log("signed file written", { signedPath });

  // Create audit trail
  await PdfAudit.create({
    pdfId,
    userId,
    originalHash,
    signedHash,
    fieldsMeta: fields,
  });
  console.log("PdfAudit.create called", { pdfId, userId });

  // Update PDF status
  pdfMeta.status = "signed";
  await pdfMeta.save();
  console.log("pdfMeta saved", { id: pdfMeta._id, status: pdfMeta.status });

  console.log("signPdf returning signedPath", { signedPath });
  return signedPath;
};