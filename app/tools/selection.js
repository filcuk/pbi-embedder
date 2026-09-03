/**
 * Tooling selection — family (M / DAX), input/output formats, M-JSON / Base64 options.
 * Pure helpers for the converter chrome; no DOM.
 */

/** @typedef {"m" | "dax"} Family */
/** @typedef {"tabular" | "json" | "m-json" | "base64"} Format */
/** @typedef {"single" | "escaped"} QuoteStyle */
/** @typedef {"original" | "format" | "compact"} Formatting */
/**
 * @typedef {{
 *   family: Family,
 *   input: Format,
 *   output: Format,
 *   quoteStyle: QuoteStyle,
 *   formatting: Formatting,
 *   includeParsing: boolean,
 *   convertQuotes: boolean,
 *   gzip: boolean,
 * }} ToolSelection
 */

/** @type {readonly Format[]} */
export const FORMATS = Object.freeze(["tabular", "json", "m-json", "base64"]);

/** @type {readonly Formatting[]} */
export const FORMATTINGS = Object.freeze(["original", "format", "compact"]);

/** @type {Readonly<Record<Format, string>>} */
export const FORMAT_LABELS = Object.freeze({
  tabular: "Tabular",
  json: "JSON",
  "m-json": "M-JSON",
  base64: "Base64",
});

/** @type {Readonly<Record<Family, string>>} */
export const FAMILY_LABELS = Object.freeze({
  m: "M",
  dax: "DAX",
});

/**
 * @param {unknown} value
 * @returns {value is Format}
 */
export function isFormat(value) {
  return FORMATS.includes(/** @type {Format} */ (value));
}

/**
 * @param {unknown} value
 * @returns {value is Formatting}
 */
export function isFormatting(value) {
  return FORMATTINGS.includes(/** @type {Formatting} */ (value));
}

/**
 * Resolve formatting from a partial selection, including legacy `compact`.
 * @param {Partial<ToolSelection> & { compact?: boolean }} [initial]
 * @returns {Formatting}
 */
export function resolveFormatting(initial = {}) {
  if (isFormatting(initial.formatting)) return initial.formatting;
  if (typeof initial.compact === "boolean") {
    return initial.compact ? "compact" : "format";
  }
  return "format";
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
    base64: "Base64-encoded JSON",
  };
  /** @type {Readonly<Record<Format, string>>} */
  const to = {
    tabular: "a table",
    json: "plain JSON",
    "m-json": "M-encoded JSON for Power Query",
    base64: "Base64-encoded JSON",
  };
  return `Convert ${from[input] ?? input} to ${to[output] ?? output}.`;
}

/**
 * @param {Partial<ToolSelection> & { compact?: boolean }} [initial]
 * @returns {{
 *   get: () => ToolSelection,
 *   setFamily: (family: Family) => ToolSelection,
 *   setInput: (input: Format) => ToolSelection,
 *   setOutput: (output: Format) => ToolSelection,
 *   setQuoteStyle: (quoteStyle: QuoteStyle) => ToolSelection,
 *   setFormatting: (formatting: Formatting) => ToolSelection,
 *   setIncludeParsing: (includeParsing: boolean) => ToolSelection,
 *   setConvertQuotes: (convertQuotes: boolean) => ToolSelection,
 *   setGzip: (gzip: boolean) => ToolSelection,
 *   heading: () => string,
 *   lead: () => string,
 *   showOptions: () => boolean,
 *   showMJsonOptions: () => boolean,
 *   showIncludeParsing: () => boolean,
 *   showGzip: () => boolean,
 *   showConvertQuotes: () => boolean,
 * }}
 */
export function createSelection(initial = {}) {
  /** @type {Family} */
  // DAX control is disabled in the UI; ignore persisted/initial "dax" so the
  // heading cannot say DAX while the radiogroup stays on M.
  let family = "m";
  /** @type {Format} */
  let input = isFormat(initial.input) ? initial.input : "tabular";
  /** @type {Format} */
  let output = isFormat(initial.output)
    ? initial.output
    : defaultOutputForInput(input);
  /** @type {QuoteStyle} */
  let quoteStyle = initial.quoteStyle === "single" ? "single" : "escaped";
  /** @type {Formatting} */
  let formatting = resolveFormatting(initial);
  let includeParsing = Boolean(initial.includeParsing);
  let convertQuotes =
    initial.convertQuotes === undefined ? true : Boolean(initial.convertQuotes);
  let gzip = initial.gzip === undefined ? true : Boolean(initial.gzip);

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
      formatting,
      includeParsing,
      convertQuotes,
      gzip,
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
    setFormatting(next) {
      if (!isFormatting(next)) return snapshot();
      formatting = next;
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
    setGzip(next) {
      gzip = Boolean(next);
      return snapshot();
    },
    heading() {
      return formatConversionHeading(snapshot());
    },
    lead() {
      return formatConversionLead(snapshot());
    },
    showOptions() {
      return output === "m-json" || input === "base64" || output === "base64";
    },
    showMJsonOptions() {
      return output === "m-json";
    },
    showIncludeParsing() {
      return output === "m-json" || output === "base64";
    },
    showGzip() {
      return input === "base64" || output === "base64";
    },
    showConvertQuotes() {
      return quoteStyle === "single" && includeParsing;
    },
  };
}
