/**
 * Tooling selection — family (M / DAX), input/output formats, M-JSON quote style.
 * Pure helpers for the converter chrome; no DOM.
 */

/** @typedef {"m" | "dax"} Family */
/** @typedef {"tabular" | "json" | "m-json"} Format */
/** @typedef {"single" | "escaped"} QuoteStyle */
/**
 * @typedef {{
 *   family: Family,
 *   input: Format,
 *   output: Format,
 *   quoteStyle: QuoteStyle,
 * }} ToolSelection
 */

/** @type {readonly Format[]} */
export const FORMATS = Object.freeze(["tabular", "json", "m-json"]);

/** @type {Readonly<Record<Format, string>>} */
export const FORMAT_LABELS = Object.freeze({
  tabular: "Tabular",
  json: "JSON",
  "m-json": "M-JSON",
});

/** @type {Readonly<Record<Family, string>>} */
export const FAMILY_LABELS = Object.freeze({
  m: "M",
  dax: "DAX",
});

/** @type {Readonly<Record<QuoteStyle, string>>} */
export const QUOTE_STYLE_LABELS = Object.freeze({
  single: "Single quotes",
  escaped: "Escaped quotes",
});

/**
 * @param {unknown} value
 * @returns {value is Format}
 */
export function isFormat(value) {
  return FORMATS.includes(/** @type {Format} */ (value));
}

/**
 * Default output format when the input format changes.
 * @param {Format} input
 * @returns {Format}
 */
export function defaultOutputForInput(input) {
  if (input === "m-json") return "tabular";
  return "m-json";
}

/**
 * Human-readable conversion heading, e.g. `M: Tabular → M-JSON`.
 * @param {Pick<ToolSelection, "family" | "input" | "output">} selection
 */
export function formatConversionHeading({ family, input, output }) {
  const familyLabel = FAMILY_LABELS[family] ?? String(family);
  const inputLabel = FORMAT_LABELS[input] ?? String(input);
  const outputLabel = FORMAT_LABELS[output] ?? String(output);
  return `${familyLabel}: ${inputLabel} → ${outputLabel}`;
}

/**
 * @param {Partial<ToolSelection>} [initial]
 * @returns {{
 *   get: () => ToolSelection,
 *   setFamily: (family: Family) => ToolSelection,
 *   setInput: (input: Format) => ToolSelection,
 *   setOutput: (output: Format) => ToolSelection,
 *   setQuoteStyle: (quoteStyle: QuoteStyle) => ToolSelection,
 *   heading: () => string,
 *   showQuoteStyle: () => boolean,
 * }}
 */
export function createSelection(initial = {}) {
  /** @type {Family} */
  let family = initial.family === "dax" ? "dax" : "m";
  /** @type {Format} */
  let input = isFormat(initial.input) ? initial.input : "tabular";
  /** @type {Format} */
  let output = isFormat(initial.output)
    ? initial.output
    : defaultOutputForInput(input);
  /** @type {QuoteStyle} */
  let quoteStyle = initial.quoteStyle === "escaped" ? "escaped" : "single";

  if (output === input) {
    output = defaultOutputForInput(input);
  }

  /** @returns {ToolSelection} */
  function snapshot() {
    return { family, input, output, quoteStyle };
  }

  return {
    get: snapshot,
    setFamily(next) {
      family = next === "dax" ? "dax" : "m";
      return snapshot();
    },
    setInput(next) {
      if (!isFormat(next)) return snapshot();
      input = next;
      output = defaultOutputForInput(input);
      return snapshot();
    },
    setOutput(next) {
      if (!isFormat(next) || next === input) return snapshot();
      output = next;
      return snapshot();
    },
    setQuoteStyle(next) {
      quoteStyle = next === "escaped" ? "escaped" : "single";
      return snapshot();
    },
    heading() {
      return formatConversionHeading(snapshot());
    },
    showQuoteStyle() {
      return output === "m-json";
    },
  };
}
