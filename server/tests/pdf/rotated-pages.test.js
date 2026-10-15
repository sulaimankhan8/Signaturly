import { describe, it, expect } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { api, createUser } from "../helpers.js";
import { renderPdfPage } from "../render.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { readFile } from "../../src/services/storage.service.js";

/**
 * Fields are placed on the page as a reader sees it: turned by the page's /Rotate and cut to its
 * crop box. A mark must land in the same place on the stamped file, whatever the page's rotation.
 */

const upload = async (account, buffer) => {
  const res = await api().post("/api/pdf/upload").set(account.auth).attach("pdf", buffer, { filename: "turned.pdf", contentType: "application/pdf" });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
};

const pageWith = async ({ rotation = 0, crop = null }) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  if (crop) page.setCropBox(crop.x, crop.y, crop.width, crop.height);
  page.setRotation(degrees(rotation));
  return Buffer.from(await doc.save());
};

// The share of the rendered page's ink that falls inside a box given as shares of the page
const inkInside = (canvas, area) => {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  let total = 0;
  let inside = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] >= 384) continue;
      total += 1;
      const u = x / canvas.width;
      const v = y / canvas.height;
      if (u >= area.left && u <= area.right && v >= area.top && v <= area.bottom) inside += 1;
    }
  }
  return { total, share: total ? inside / total : 0 };
};

// A ticked checkbox near the top-left corner of the page as shown
const tick = { id: "tick", type: "checkbox", page: 1, xPercent: 0.1, yPercent: 0.1, widthPercent: 0.1, heightPercent: 0.1, checked: true, value: true };

const signAndRender = async (buffer) => {
  const owner = await createUser();
  const doc = await upload(owner, buffer);
  const res = await api().post("/api/pdf/sign").set(owner.auth).send({ pdfId: doc.id, fields: [tick] });
  expect(res.status).toBe(200);

  // The stamped working copy, before the signing record is attached
  const stored = await Pdf.findById(doc.id);
  const stamped = await readFile(stored.versions[stored.versions.length - 1].key);
  return (await renderPdfPage(stamped, 1, 1)).canvas;
};

describe("marks land where they were placed on turned and cropped pages", () => {
  for (const rotation of [0, 90, 180, 270]) {
    it(`a page turned ${rotation}°`, async () => {
      const canvas = await signAndRender(await pageWith({ rotation }));
      const ink = inkInside(canvas, { left: 0.08, right: 0.22, top: 0.08, bottom: 0.22 });
      expect(ink.total).toBeGreaterThan(50);
      expect(ink.share).toBeGreaterThan(0.95);
    });
  }

  it("a page whose crop box starts away from the corner", async () => {
    const canvas = await signAndRender(await pageWith({ crop: { x: 100, y: 150, width: 400, height: 500 } }));
    const ink = inkInside(canvas, { left: 0.08, right: 0.22, top: 0.08, bottom: 0.22 });
    expect(ink.total).toBeGreaterThan(50);
    expect(ink.share).toBeGreaterThan(0.95);
  });

  it("a cropped page that is also turned", async () => {
    const canvas = await signAndRender(await pageWith({ rotation: 90, crop: { x: 50, y: 100, width: 450, height: 600 } }));
    const ink = inkInside(canvas, { left: 0.08, right: 0.22, top: 0.08, bottom: 0.22 });
    expect(ink.total).toBeGreaterThan(50);
    expect(ink.share).toBeGreaterThan(0.95);
  });
});
