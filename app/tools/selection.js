/**
 * Tooling selection — family (M / DAX), input/output formats, M-JSON options.
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
 *   compact: boolean,
 *   includeParsing: boolean,
 *   convertQuotes: boolean,
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
  escaped: "Escaped quotes",
  single: "Single quotes",
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
 * Short lead describing the active conversion (no “What?” control).
 * @param {Pick<ToolSelection, "input" | "output">} selection
 */
export function formatConversionLead({ input, output }) {
  /** @type {Readonly<Record<Format, string>>} */
  const from = {
    tabular: "tabular data",
    json: "JSON records",
    "m-json": "M-encoded JSON",
  };
  /** @type {Readonly<Record<Format, string>>} */
  const to = {
    tabular: "a table",
    json: "plain JSON",
    "m-json": "M-encoded JSON for Power Query",
  };
  return `Convert ${from[input] ?? input} to ${to[output] ?? output}.`;
}

/**
 * @param {Partial<ToolSelection>} [initial]
 * @returns {{
 *   get: () => ToolSelection,
 *   setFamily: (family: Family) => ToolSelection,
 *   setInput: (input: Format) => ToolSelection,
 *   setOutput: (output: Format) => ToolSelection,
 *   setQuoteStyle: (quoteStyle: QuoteStyle) => ToolSelection,
 *   setCompact: (compact: boolean) => ToolSelection,
 *   setIncludeParsing: (includeParsing: boolean) => ToolSelection,
 *   setConvertQuotes: (convertQuotes: boolean) => ToolSelection,
 *   heading: () => string,
 *   lead: () => string,
 *   showOptions: () => boolean,
 *   showConvertQuotes: () => boolean,
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
  let quoteStyle = initial.quoteStyle === "single" ? "single" : "escaped";
  let compact = Boolean(initial.compact);
  let includeParsing = Boolean(initial.includeParsing);
  let convertQuotes =
    initial.convertQuotes === undefined ? true : Boolean(initial.convertQuotes);

  if (output === input) {
    output = defaultOutputForInput(input);
  }

  /** @returns {ToolSelection} */
  function snapshot() {
    return {
      family,
      input,
      output,
      quoteStyle,
      compact,
      includeParsing,
      convertQuotes,
    };
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
      quoteStyle = next === "single" ? "single" : "escaped";
      return snapshot();
    },
    setCompact(next) {
      compact = Boolean(next);
      return snapshot();
    },
    setIncludeParsing(next) {
      includeParsing = Boolean(next);
      return snapshot();
    },
    setConvertQuotes(next) {
      convertQuotes = Boolean(next);
      return snapshot();
    },
    heading() {
      return formatConversionHeading(snapshot());
    },
    lead() {
      return formatConversionLead(snapshot());
    },
    showOptions() {
      return output === "m-json";
    },
    showConvertQuotes() {
      return quoteStyle === "single" && includeParsing;
    },
  };
}
