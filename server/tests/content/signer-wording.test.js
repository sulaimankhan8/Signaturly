import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import en from "../../../client/src/i18n/locales/en.js";
import hi from "../../../client/src/i18n/locales/hi.js";

// Plan task P3-03: every word a signer sees comes from the translation files, so a signer who
// reads Hindi is never shown a stray English sentence.

const CLIENT = path.resolve(import.meta.dirname, "../../../client/src");

// The screens a signer sees, and the components those screens are built from
const SIGNER_SCREENS = [
  "pages/SigningPage.jsx",
  "components/OtpVerificationModal.jsx",
  "components/SignatureManager.jsx",
  "components/SignaturePad.jsx",
  "components/TypeSignature.jsx",
  "components/VerifiedESignBadge.jsx",
  "components/InitialsStudio.jsx",
  "components/DraggableField.jsx",
  "components/PdfViewer.jsx",
];

const LOCALES = { en, hi };

// Attributes whose text is shown or read out to the person
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "alt", "aria-label", "label"]);
// Object keys that by convention hold text for the person
const VISIBLE_KEYS = new Set(["label", "title", "placeholder", "description", "text", "message", "hint"]);
// Calls that show their arguments to the person
const SHOWS_ITS_ARGUMENTS = /^(toast(\.\w+)?|setError|setSentMessage|alert|confirm)$/;
// Calls that fetch wording from the translation files
const TRANSLATES = /^(t|i18n\.t)$/;

const looksLikeWords = (value) => /\p{L}{2,}/u.test(value);

const calleeName = (node) => {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed) return `${calleeName(node.object)}.${node.property.name}`;
  return "";
};

/**
 * Walks a source file and returns every piece of text that would reach the screen without
 * going through the translation files. `visible` says whether a string met at this point of
 * the tree would be shown.
 */
const hardcodedText = (source) => {
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  const found = [];
  const report = (node, value) => found.push(`line ${node.loc.start.line}: ${value.trim().replace(/\s+/g, " ").slice(0, 80)}`);

  const each = (value, visible) => {
    if (Array.isArray(value)) value.forEach((item) => each(item, visible));
    else if (value && typeof value.type === "string") visit(value, visible);
  };

  const visitChildren = (node, visible) => {
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
      each(node[key], visible);
    }
  };

  function visit(node, visible) {
    switch (node.type) {
      case "JSXText":
        if (looksLikeWords(node.value)) report(node, node.value);
        return;

      case "JSXElement":
      case "JSXFragment":
        each(node.openingElement?.attributes, false);
        for (const child of node.children) {
          if (child.type === "JSXExpressionContainer") visit(child.expression, true);
          else visit(child, false);
        }
        return;

      case "JSXAttribute": {
        const name = node.name.name;
        if (!node.value) return;
        const shown = VISIBLE_ATTRIBUTES.has(name);
        if (node.value.type === "JSXExpressionContainer") visit(node.value.expression, shown);
        else visit(node.value, shown);
        return;
      }

      case "StringLiteral":
        if (visible && looksLikeWords(node.value)) report(node, node.value);
        return;

      case "TemplateLiteral":
        if (visible && node.quasis.some((q) => looksLikeWords(q.value.cooked || ""))) {
          report(node, node.quasis.map((q) => q.value.cooked).join("{}"));
        }
        each(node.expressions, false);
        return;

      case "CallExpression": {
        const name = calleeName(node.callee);
        if (TRANSLATES.test(name)) return;
        visit(node.callee, false);
        each(node.arguments, SHOWS_ITS_ARGUMENTS.test(name));
        return;
      }

      case "ConditionalExpression":
        visit(node.test, false);
        visit(node.consequent, visible);
        visit(node.alternate, visible);
        return;

      case "LogicalExpression":
        // In `condition && "text"` only the right side is shown; in `value || "fallback"` either may be
        visit(node.left, node.operator === "&&" ? false : visible);
        visit(node.right, visible);
        return;

      case "BinaryExpression":
        // Comparisons are never shown; a "+" may be joining text
        if (node.operator === "+") {
          visit(node.left, visible);
          visit(node.right, visible);
        } else {
          visit(node.left, false);
          visit(node.right, false);
        }
        return;

      case "ObjectProperty": {
        const key = node.key.name || node.key.value;
        if (node.computed) visit(node.key, false);
        visit(node.value, VISIBLE_KEYS.has(key) ? true : false);
        return;
      }

      case "MemberExpression":
        visit(node.object, false);
        if (node.computed) visit(node.property, false);
        return;

      case "ImportDeclaration":
        return;

      default:
        // Statements, functions, arrays and so on: nothing in them is shown unless a rule above says so
        visitChildren(node, false);
    }
  }

  visit(ast.program, false);
  return found;
};

const flatten = (object, prefix = "") =>
  Object.entries(object).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`)
  );

const placeholdersOf = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("P3-03 the scanner itself", () => {
  it("catches text written straight into a screen", () => {
    const sample = `
      export default function Sample({ done }) {
        const tabs = [{ id: "a", label: "First tab" }];
        if (!done) toast.error("Please finish first");
        return (
          <div className="text-xs font-bold" title="Hover text">
            Plain words
            {done ? "Finished" : "Waiting"}
            <input placeholder="Type here" />
            {\`Page \${done}\`}
          </div>
        );
      }`;
    const found = hardcodedText(sample).join("\n");
    for (const text of ["First tab", "Please finish first", "Hover text", "Plain words", "Finished", "Waiting", "Type here", "Page {}"]) {
      expect(found).toContain(text);
    }
  });

  it("accepts translated text, styling and logic", () => {
    const sample = `
      export default function Sample({ kind }) {
        const { t } = useTranslation();
        if (kind === "signature") toast.success(t("toast.signed"));
        return (
          <div className={\`p-2 \${kind === "date" ? "text-red-400" : "text-gray-400"}\`} title={t("field.remove")}>
            {t("sidebar.remaining", { count: 2 })}
            <span aria-hidden="true">◀</span>
            {kind === "text" ? t("fieldType.text") : t(\`fieldType.\${kind}\`)}
          </div>
        );
      }`;
    expect(hardcodedText(sample)).toEqual([]);
  });
});

describe("P3-03 signer screens carry no untranslated text", () => {
  for (const file of SIGNER_SCREENS) {
    it(file, () => {
      expect(hardcodedText(fs.readFileSync(path.join(CLIENT, file), "utf8"))).toEqual([]);
    });
  }

  it("uses only wording keys that exist", () => {
    const known = new Set(flatten(en).map(([key]) => key));
    const missing = [];
    for (const file of SIGNER_SCREENS) {
      const source = fs.readFileSync(path.join(CLIENT, file), "utf8");
      for (const match of source.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
        if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
      for (const match of source.matchAll(/labelKey:\s*"([\w.]+)"/g)) {
        if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("P3-03 every signing language is complete", () => {
  const english = new Map(flatten(en));

  for (const [code, wording] of Object.entries(LOCALES)) {
    if (code === "en") continue;

    it(`${code} has every key English has, and no others`, () => {
      const keys = flatten(wording).map(([key]) => key);
      expect(keys.filter((key) => !english.has(key))).toEqual([]);
      expect([...english.keys()].filter((key) => !keys.includes(key))).toEqual([]);
    });

    it(`${code} keeps the same placeholders as English`, () => {
      const different = flatten(wording)
        .filter(([key, text]) => english.has(key) && placeholdersOf(text).join() !== placeholdersOf(english.get(key)).join())
        .map(([key]) => key);
      expect(different).toEqual([]);
    });

    it(`${code} has no empty wording`, () => {
      expect(flatten(wording).filter(([, text]) => !text.trim()).map(([key]) => key)).toEqual([]);
    });
  }

  it("lists every language file in the language switch", () => {
    const index = fs.readFileSync(path.join(CLIENT, "i18n/index.js"), "utf8");
    for (const code of Object.keys(LOCALES)) {
      expect(index).toContain(`code: "${code}"`);
      expect(index).toMatch(new RegExp(`\\b${code}: \\{ translation: ${code} \\}`));
    }
  });
});
