import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawShapedText, measureText, isPlainLatin } from "./textShaping.service.js";
import { fillText, applies } from "./templateText.service.js";
import { env } from "../config/env.js";

/**
 * Turns a template definition and a sender's answers into a PDF, and reports where each
 * signer's fields landed (plan task P4-03).
 *
 * The layout is done here, on pdf-lib, and not in a headless browser: see
 * docs/decisions/0002-template-renderer.md. Latin text is drawn with the PDF's built-in fonts
 * and stays selectable; text in Indian scripts is shaped and drawn as outlines.
 *
 * Rendering reads nothing but its two inputs, so the same definition and answers always give
 * the same file, byte for byte.
 */

// A4, the paper size used in India
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { x: 64, top: 68, bottom: 76 };
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2;

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.72, 0.74, 0.78);

const STYLES = {
  title: { size: 15, leading: 21, bold: true, align: "center", after: 6 },
  subtitle: { size: 10, leading: 14, align: "center", color: MUTED, after: 12 },
  heading: { size: 11.5, leading: 16, bold: true, before: 6, after: 4 },
  body: { size: 10.5, leading: 15.5, after: 8 },
  note: { size: 9, leading: 13, color: MUTED, after: 8 },
  cell: { size: 10, leading: 14 },
};

const CLAUSE_INDENT = 26;
const ITEM_INDENT = 24;
const SIGNATURE_ROW = 126;

// The few words the renderer itself prints, in the language of the template
const LABELS = {
  en: { name: "Name:", date: "Date:", page: "Page {n} of {total}" },
  hi: { name: "नाम:", date: "तारीख:", page: "पृष्ठ {n} / {total}" },
};

// Fixed, so that rendering the same input twice gives the same bytes
const FIXED_DATE = new Date(Date.UTC(2000, 0, 1));

export const BLOCK_TYPES = ["title", "subtitle", "heading", "paragraph", "note", "clause", "list", "table", "signatures", "pagebreak"];

// Control characters have no glyph and would break the built-in fonts
const clean = (text) => String(text ?? "").replace(/\t/g, " ").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");

const letter = (index) => String.fromCharCode(97 + (index % 26));

export const renderTemplate = async (definition, answers = {}) => {
  const language = definition.language || "en";
  const labels = LABELS[language] || LABELS.en;
  const fill = (text) => clean(fillText(text, answers, { language, questions: definition.questions }));

  const doc = await PDFDocument.create();
  doc.setTitle(clean(definition.title));
  doc.setProducer(env.appName);
  doc.setCreator(env.appName);
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const widthOf = (text, bold, size) =>
    isPlainLatin(text) ? (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(text, size) : measureText(text, size, { bold });

  // ---------- pages ----------
  let page;
  let y; // top of the next line
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN.top;
  };
  const atTop = () => y >= PAGE.height - MARGIN.top - 0.5;
  const ensure = (height) => {
    if (y - height < MARGIN.bottom) newPage();
  };
  newPage();

  // ---------- text ----------
  // "**bold**" marks come from the template only: answers are filled in after the split,
  // so a sender cannot switch formatting on by typing asterisks
  const runsOf = (templateText, baseBold = false) =>
    String(templateText ?? "")
      .split("**")
      .map((part, index) => ({ text: fill(part), bold: baseBold || index % 2 === 1 }))
      .filter((run) => run.text);

  const layout = (runs, size, maxWidth) => {
    const space = fonts.regular.widthOfTextAtSize(" ", size);
    const lines = [];
    let line = { words: [], width: 0 };
    const push = () => {
      lines.push(line);
      line = { words: [], width: 0 };
    };
    // `glue` joins a word to the one before it with no space: a bold name followed by a comma
    const add = (text, bold, glue = false) => {
      const width = widthOf(text, bold, size);
      const joined = glue && line.words.length > 0;
      if (!joined && line.words.length && line.width + space + width > maxWidth) push();
      line.width += (line.words.length && !joined ? space : 0) + width;
      line.words.push({ text, bold, width, glue: joined });
    };

    let endedWithSpace = true;
    for (const run of runs) {
      const paragraphs = run.text.split("\n");
      paragraphs.forEach((paragraph, index) => {
        if (index > 0) {
          push();
          endedWithSpace = true;
        }
        let glue = !endedWithSpace && !/^ /.test(paragraph);
        for (const word of paragraph.split(/ +/).filter(Boolean)) {
          if (widthOf(word, run.bold, size) <= maxWidth) {
            add(word, run.bold, glue);
            glue = false;
            continue;
          }
          // A single word wider than the line (a long reference number or web address) is cut to fit
          let piece = "";
          for (const character of Array.from(word)) {
            if (piece && widthOf(piece + character, run.bold, size) > maxWidth) {
              add(piece, run.bold);
              piece = "";
            }
            piece += character;
          }
          if (piece) add(piece, run.bold);
          glue = false;
        }
        if (paragraph) endedWithSpace = / $/.test(paragraph);
      });
    }
    if (line.words.length || lines.length === 0) lines.push(line);
    return { lines, space };
  };

  const drawLine = (line, { x, baseline, size, color, space }) => {
    // Neighbouring words of the same kind are drawn as one string, so Latin text selects as sentences
    let cursor = x;
    let index = 0;
    while (index < line.words.length) {
      const first = line.words[index];
      const plain = isPlainLatin(first.text);
      let text = first.text;
      let width = first.width;
      let next = index + 1;
      while (
        next < line.words.length &&
        !line.words[next].glue &&
        line.words[next].bold === first.bold &&
        isPlainLatin(line.words[next].text) === plain
      ) {
        text += ` ${line.words[next].text}`;
        width += space + line.words[next].width;
        next += 1;
      }

      if (index > 0 && !first.glue) cursor += space;
      if (plain) page.drawText(text, { x: cursor, y: baseline, size, font: first.bold ? fonts.bold : fonts.regular, color });
      else drawShapedText(page, text, { x: cursor, y: baseline, size, color, bold: first.bold });

      cursor += width;
      index = next;
    }
  };

  /**
   * Draws wrapped text at the cursor and moves the cursor below it.
   * `keep` is extra height that must fit on the page with the first line (a heading keeps its first lines of body).
   */
  const drawText = (runs, style, { x = MARGIN.x, width = CONTENT_WIDTH, keep = 0, marker = null } = {}) => {
    if (style.before && !atTop()) y -= style.before;
    const { lines, space } = layout(runs, style.size, width);

    lines.forEach((line, index) => {
      ensure(style.leading + (index === 0 ? keep : 0));
      const baseline = y - style.size * 0.82;
      const offset = style.align === "center" ? (width - line.width) / 2 : 0;
      if (index === 0 && marker) {
        page.drawText(marker.text, { x: marker.x, y: baseline, size: style.size, font: marker.bold ? fonts.bold : fonts.regular, color: style.color || INK });
      }
      drawLine(line, { x: x + offset, baseline, size: style.size, color: style.color || INK, space });
      y -= style.leading;
    });
    y -= style.after || 0;
  };

  const write = (text, { x, baseline, size, bold = false, color = INK }) => {
    if (isPlainLatin(text)) page.drawText(text, { x, y: baseline, size, font: bold ? fonts.bold : fonts.regular, color });
    else drawShapedText(page, text, { x, y: baseline, size, color, bold });
  };

  // Height a block of text will take, so it can be kept on one page with what follows it
  const heightOf = (block) => {
    const lines = (text, width) => layout(runsOf(text), STYLES.body.size, width).lines.length;
    const items = (block.items || []).filter((item) => typeof item === "string" || applies(item.showIf, answers));
    const itemText = (item) => (typeof item === "string" ? item : item.text);
    switch (block.type) {
      case "paragraph":
        return lines(block.text, CONTENT_WIDTH) * STYLES.body.leading + STYLES.body.after;
      case "note":
        return layout(runsOf(block.text), STYLES.note.size, CONTENT_WIDTH).lines.length * STYLES.note.leading + STYLES.note.after;
      case "clause":
        return (
          lines(`${block.heading ? `${block.heading}. ` : ""}${block.text}`, CONTENT_WIDTH - CLAUSE_INDENT) * STYLES.body.leading +
          items.reduce((sum, item) => sum + lines(itemText(item), CONTENT_WIDTH - CLAUSE_INDENT - ITEM_INDENT) * STYLES.body.leading + 3, 0) +
          STYLES.body.after
        );
      case "list":
        return items.reduce((sum, item) => sum + lines(itemText(item), CONTENT_WIDTH - ITEM_INDENT) * STYLES.body.leading + 3, 0) + STYLES.body.after;
      default:
        return null;
    }
  };

  // ---------- blocks ----------
  const fields = [];
  let clauseNumber = 0;
  let signatureBlocks = 0;

  const toField = (role, type, box, suffix) => ({
    id: `${role.id}-${type}${suffix}`,
    roleId: role.id,
    roleName: role.name,
    roleColor: role.color || "#3b82f6",
    type,
    page: doc.getPageCount(),
    xPercent: box.x / PAGE.width,
    // Field positions are measured from the top of the page; PDF coordinates start at the bottom
    yPercent: (PAGE.height - (box.y + box.height)) / PAGE.height,
    widthPercent: box.width / PAGE.width,
    heightPercent: box.height / PAGE.height,
    required: true,
  });

  const drawSignatures = (block) => {
    const roles = (definition.roles || []).filter((role) => !block.roles || block.roles.includes(role.id));
    const suffix = signatureBlocks === 0 ? "" : `-${signatureBlocks + 1}`;
    signatureBlocks += 1;

    const gap = 28;
    const columnWidth = (CONTENT_WIDTH - gap) / 2;
    const rowHeight = SIGNATURE_ROW;
    if (!atTop()) y -= 10;

    for (let index = 0; index < roles.length; index += 2) {
      ensure(rowHeight);
      const top = y;

      roles.slice(index, index + 2).forEach((role, column) => {
        const x = MARGIN.x + column * (columnWidth + gap);

        y = top;
        drawText([{ text: clean(role.name), bold: true }], { size: 10, leading: 14 }, { x, width: columnWidth });

        // Signature: the signer's mark sits on the rule
        const signature = { x, y: top - 14 - 52, width: columnWidth, height: 48 };
        page.drawLine({ start: { x, y: signature.y }, end: { x: x + columnWidth, y: signature.y }, thickness: 0.75, color: RULE });
        fields.push(toField(role, "signature", signature, suffix));

        y = signature.y - 6;
        const name = role.nameFrom ? fill(`{{${role.nameFrom}}}`) : "";
        drawText([{ text: `${labels.name} ${name}`, bold: false }], { size: 9.5, leading: 13 }, { x, width: columnWidth });

        const labelWidth = widthOf(`${labels.date} `, false, 9.5) + 3;
        write(labels.date, { x, baseline: y - 14, size: 9.5 });
        const date = { x: x + labelWidth, y: y - 19, width: 120, height: 18 };
        page.drawLine({ start: { x: date.x, y: date.y }, end: { x: date.x + date.width, y: date.y }, thickness: 0.75, color: RULE });
        fields.push(toField(role, "date", date, suffix));
      });

      y = top - rowHeight;
    }
  };

  const drawTable = (block) => {
    const style = STYLES.cell;
    const padding = 6;
    const labelWidth = CONTENT_WIDTH * 0.36;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    if (!atTop()) y -= 2;

    for (const [label, value] of block.rows || []) {
      const left = layout(runsOf(label, true), style.size, labelWidth - padding * 2);
      const right = layout(runsOf(value), style.size, valueWidth - padding * 2);
      const height = Math.max(left.lines.length, right.lines.length) * style.leading + padding * 2;
      ensure(height);

      const top = y;
      page.drawRectangle({ x: MARGIN.x, y: top - height, width: CONTENT_WIDTH, height, borderColor: RULE, borderWidth: 0.6 });
      page.drawLine({ start: { x: MARGIN.x + labelWidth, y: top }, end: { x: MARGIN.x + labelWidth, y: top - height }, thickness: 0.6, color: RULE });

      [[left, MARGIN.x + padding], [right, MARGIN.x + labelWidth + padding]].forEach(([cell, x]) => {
        cell.lines.forEach((line, index) => {
          drawLine(line, { x, baseline: top - padding - style.size * 0.82 - index * style.leading, size: style.size, color: INK, space: cell.space });
        });
      });
      y = top - height;
    }
    y -= 10;
  };

  const blocks = (definition.body || []).filter((block) => applies(block.showIf, answers));

  blocks.forEach((block, position) => {
    // A page that holds nothing but signatures can be detached from what was agreed.
    // The last piece of text therefore moves to the next page together with the signatures.
    if (blocks[position + 1]?.type === "signatures") {
      const together = heightOf(block);
      const room = PAGE.height - MARGIN.top - MARGIN.bottom;
      if (together !== null && together + 10 + SIGNATURE_ROW <= room) ensure(together + 10 + SIGNATURE_ROW);
    }

    switch (block.type) {
      case "title":
        drawText(runsOf(block.text, true), STYLES.title);
        break;
      case "subtitle":
        drawText(runsOf(block.text), STYLES.subtitle);
        break;
      case "heading":
        drawText(runsOf(block.text, true), STYLES.heading, { keep: STYLES.body.leading * 2 });
        break;
      case "paragraph":
        drawText(runsOf(block.text), STYLES.body);
        break;
      case "note":
        drawText(runsOf(block.text), STYLES.note);
        break;

      case "clause": {
        clauseNumber += 1;
        const runs = [...(block.heading ? [{ text: `${fill(block.heading)}. `, bold: true }] : []), ...runsOf(block.text)];
        const items = (block.items || []).filter((item) => typeof item === "string" || applies(item.showIf, answers));
        drawText(runs, { ...STYLES.body, after: items.length ? 4 : STYLES.body.after }, {
          x: MARGIN.x + CLAUSE_INDENT,
          width: CONTENT_WIDTH - CLAUSE_INDENT,
          keep: STYLES.body.leading,
          marker: { text: `${clauseNumber}.`, x: MARGIN.x, bold: true },
        });
        items.forEach((item, index) => {
          const last = index === items.length - 1;
          drawText(runsOf(typeof item === "string" ? item : item.text), { ...STYLES.body, after: last ? STYLES.body.after : 3 }, {
            x: MARGIN.x + CLAUSE_INDENT + ITEM_INDENT,
            width: CONTENT_WIDTH - CLAUSE_INDENT - ITEM_INDENT,
            marker: { text: `(${letter(index)})`, x: MARGIN.x + CLAUSE_INDENT },
          });
        });
        break;
      }

      case "list": {
        const items = (block.items || []).filter((item) => typeof item === "string" || applies(item.showIf, answers));
        items.forEach((item, index) => {
          const last = index === items.length - 1;
          drawText(runsOf(typeof item === "string" ? item : item.text), { ...STYLES.body, after: last ? STYLES.body.after : 3 }, {
            x: MARGIN.x + ITEM_INDENT,
            width: CONTENT_WIDTH - ITEM_INDENT,
            marker: { text: block.ordered ? `${index + 1}.` : "-", x: MARGIN.x + 6 },
          });
        });
        break;
      }

      case "table":
        drawTable(block);
        break;
      case "signatures":
        drawSignatures(block);
        break;
      case "pagebreak":
        if (!atTop()) newPage();
        break;
      default:
        throw new Error(`Unknown template block type: ${block.type}`);
    }
  });

  // ---------- page numbers ----------
  const pages = doc.getPages();
  pages.forEach((numbered, index) => {
    page = numbered;
    const text = labels.page.replace("{n}", index + 1).replace("{total}", pages.length);
    write(text, { x: (PAGE.width - widthOf(text, false, 8)) / 2, baseline: 40, size: 8, color: MUTED });
  });

  return { buffer: Buffer.from(await doc.save()), pageCount: pages.length, fields };
};
