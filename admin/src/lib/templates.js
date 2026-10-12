/**
 * Helpers for the Templates page: the parts of a template edited as JSON, and where a
 * problem the server reports belongs on the form.
 */

// The parts of a template that hold structure
export const JSON_FIELDS = [
  ["roles", "Signers", "Who signs, and which question holds each one's name."],
  ["questions", "Questions", "What the sender is asked. A question's id is what the text refers to in {{double braces}}."],
  ["body", "Text", "The document, block by block: title, paragraph, clause, list, table, signatures."],
  ["stateNotes", "State notes", "Short notes shown to the sender for a state."],
];

export const HINT_LEVELS = [
  ["esign_ok", "Ordinary e-signature is usual"],
  ["stamp_duty", "Stamp duty applies"],
  ["aadhaar_advised", "Aadhaar eSign advised"],
  ["check", "Check before relying on it"],
];

// A saved version, as the fields of the form
export const toForm = (version) => ({
  title: version.title || "",
  summary: version.summary || "",
  pack: version.pack || "",
  industry: version.industry || "",
  hintLevel: version.signatureHint?.level || "check",
  hintText: version.signatureHint?.text || "",
  ...Object.fromEntries(JSON_FIELDS.map(([field]) => [field, JSON.stringify(version[field] || [], null, 2)])),
});

const NUMBER_OR_WORD = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/;

/**
 * Reads JSON far enough to find its first mistake. Returns { index, what }, or null when
 * the text is sound. Browsers do not agree on how they report a mistake, and the current
 * ones no longer say where it is, so the place is found here.
 */
const firstMistake = (text) => {
  let i = 0;
  const stop = (what) => {
    throw { index: i, what };
  };
  const space = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i += 1;
  };
  const string = () => {
    i += 1;
    for (;;) {
      const c = text[i];
      if (c === undefined) stop("a piece of text in quotes is never closed");
      if (c === "\n") stop("text in quotes cannot run on to the next line");
      if (c === '"') {
        i += 1;
        return;
      }
      i += c === "\\" ? 2 : 1;
    }
  };
  const list = (close, item) => {
    i += 1;
    space();
    if (text[i] === close) {
      i += 1;
      return;
    }
    for (;;) {
      item();
      space();
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === close) {
        i += 1;
        return;
      }
      stop(`a comma or ${close} is expected here`);
    }
  };
  const value = () => {
    space();
    const c = text[i];
    if (c === undefined) stop("the text ends too soon");
    if (c === "{") {
      return list("}", () => {
        space();
        if (text[i] !== '"') stop('a name in "double quotes" is expected here');
        string();
        space();
        if (text[i] !== ":") stop("a colon is expected here");
        i += 1;
        value();
      });
    }
    if (c === "[") return list("]", value);
    if (c === '"') return string();
    const plain = NUMBER_OR_WORD.exec(text.slice(i, i + 400));
    if (!plain) stop("a value is expected here");
    i += plain[0].length;
    return undefined;
  };

  try {
    value();
    space();
    if (i < text.length) stop("nothing is expected after the end");
    return null;
  } catch (mistake) {
    if (mistake && typeof mistake.index === "number") return mistake;
    throw mistake;
  }
};

/**
 * What is wrong with a piece of JSON, with the line it is on, or "" when it is sound.
 */
export const jsonProblem = (text) => {
  try {
    JSON.parse(text);
    return "";
  } catch (err) {
    const mistake = firstMistake(text);
    if (!mistake) return String(err.message);
    const before = text.slice(0, mistake.index);
    return `Line ${before.split("\n").length}, column ${before.length - before.lastIndexOf("\n")}: ${mistake.what}`;
  }
};

// The same JSON, laid out with two spaces. Text that is not sound JSON is returned as it is.
export const formatJson = (text) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/**
 * Which field a problem reported by the server is about, from how the server words it:
 * "block 2 (paragraph) uses {{visitor}}, which is not a question" is about the text.
 */
export const fieldOfProblem = (problem) => {
  const text = String(problem).toLowerCase();
  if (text.startsWith("block ")) return "body";
  if (text.startsWith("question")) return "questions";
  if (text.startsWith("signer") || text.startsWith("a signer") || text.startsWith("there are no signers")) return "roles";
  if (text.startsWith("title")) return "title";
  if (text.startsWith("pack")) return "pack";
  return null;
};
