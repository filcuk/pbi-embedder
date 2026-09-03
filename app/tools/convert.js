/**
 * Pure converters between tabular grid data, JSON, M-encoded JSON, and Base64.
 */

import {
  coerceCellValue,
  detectColumnType,
} from "../components/tabular-input.js";

/** @typedef {"tabular" | "json" | "m-json" | "base64"} Format */
/** @typedef {"single" | "escaped"} QuoteStyle */
/** @typedef {"original" | "format" | "compact"} Formatting */
/** @typedef {{ id: string, label: string, type: "text" | "number" | "logical" }} Column */
/** @typedef {{ id: string, cells: Record<string, string | number | boolean | null> }} Row */
/** @typedef {{ columns: Column[], rows: Row[] }} TableData */
/** @typedef {Record<string, unknown>} RecordRow */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * @param {string} text
 * @returns {Uint8Array}
 */
export function base64ToBytes(text) {
  const cleaned = String(text ?? "").replace(/\s+/g, "");
  if (!cleaned) {
    throw new Error("Base64 input is empty.");
  }
  if (!BASE64_RE.test(cleaned)) {
    throw new Error("Invalid Base64.");
  }
  if (typeof globalThis.Buffer !== "undefined") {
    return new Uint8Array(globalThis.Buffer.from(cleaned, "base64"));
  }
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error("Invalid Base64.");
  }
}

/**
 * @param {Uint8Array} bytes
 * @param {boolean} compress
 * @returns {Promise<Uint8Array>}
 */
async function transformGzip(bytes, compress) {
  const StreamCtor = compress
    ? globalThis.CompressionStream
    : globalThis.DecompressionStream;
  if (typeof StreamCtor !== "function") {
    throw new Error(
      compress
        ? "GZip compression is not supported in this environment."
        : "GZip decompression is not supported in this environment."
    );
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new StreamCtor("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
export function gzipBytes(bytes) {
  return transformGzip(bytes, true);
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
export function gunzipBytes(bytes) {
  return transformGzip(bytes, false);
}

/**
 * @typedef {{
 *   ok: true,
 *   table: TableData,
 *   records: RecordRow[],
 *   text: string | null,
 * }} ConvertSuccess
 */

/**
 * @typedef {{
 *   ok: false,
 *   error: string,
 * }} ConvertFailure
 */

/** @typedef {ConvertSuccess | ConvertFailure} ConvertResult */

/**
 * Flatten nested values to something the grid can store.
 * @param {unknown} value
 */
export function flattenCellValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

/**
 * @param {Column[]} columns
 */
function assertUniqueColumnLabels(columns) {
  const seen = new Set();
  for (const column of columns) {
    const label = column.label;
    if (seen.has(label)) {
      throw new Error(`Duplicate column label: "${label}".`);
    }
    seen.add(label);
  }
}

/**
 * Turn a tabular-input snapshot into an array of records (keys = column labels).
 * @param {TableData | null | undefined} table
 * @returns {RecordRow[]}
 */
export function tableToRecords(table) {
  const columns = table?.columns ?? [];
  const rows = table?.rows ?? [];
  assertUniqueColumnLabels(columns);
  return rows.map((row) => {
    /** @type {RecordRow} */
    const record = {};
    for (const column of columns) {
      record[column.label] = row.cells?.[column.id] ?? null;
    }
    return record;
  });
}

/**
 * Build a tabular-input snapshot from an array of plain objects.
 * @param {unknown} value
 * @returns {TableData}
 */
export function recordsToTable(value) {
  const records = normalizeToRecords(value);
  if (!records.length) {
    return { columns: [], rows: [] };
  }

  /** @type {string[]} */
  const labels = [];
  const seen = new Set();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(key);
    }
  }

  const columns = labels.map((label, index) => {
    const values = records.map((record) => flattenCellValue(record[label]));
    const type = detectColumnType(values);
    return {
      id: `c${index + 1}`,
      label,
      type,
    };
  });

  const rows = records.map((record, rowIndex) => {
    /** @type {Record<string, string | number | boolean | null>} */
    const cells = {};
    for (const column of columns) {
      cells[column.id] = coerceCellValue(
        flattenCellValue(record[column.label]),
        column.type
      );
    }
    return { id: `r${rowIndex + 1}`, cells };
  });

  return { columns, rows };
}

/**
 * Accept a single object, an array of objects, or reject other JSON shapes.
 * @param {unknown} value
 * @returns {RecordRow[]}
 */
export function normalizeToRecords(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    for (const item of value) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(
          "JSON must be an object or an array of objects (records)."
        );
      }
    }
    return /** @type {RecordRow[]} */ (value);
  }

  if (value !== null && typeof value === "object") {
    return [/** @type {RecordRow} */ (value)];
  }

  throw new Error("JSON must be an object or an array of objects (records).");
}

/**
 * @param {string} text
 * @returns {RecordRow[]}
 */
export function parseJsonText(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    throw new Error("JSON input is empty.");
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON.");
  }

  return normalizeToRecords(parsed);
}

/**
 * Unescape an M text literal body (`""` → `"`).
 * @param {string} body
 */
export function unescapeMTextBody(body) {
  return String(body ?? "").replace(/""/g, '"');
}

/**
 * Encode a JS string as an M text literal body (`"` → `""`).
 * @param {string} value
 */
export function escapeMTextBody(value) {
  return String(value ?? "").replace(/"/g, '""');
}

/**
 * Unwrap a surrounding M / JSON string literal when present.
 * @param {string} text
 * @returns {string}
 */
export function unwrapQuotedPayload(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return unescapeMTextBody(trimmed.slice(1, -1));
  }
  return trimmed;
}

/**
 * Parse M-encoded JSON (single-quote or escaped-quote forms).
 * Also accepts a let-query that assigns the payload to a `JSON` step.
 * @param {string} text
 * @returns {RecordRow[]}
 */
export function parseMJsonText(text) {
  const trimmed = extractMJsonLiteral(String(text ?? "").trim());
  if (!trimmed) {
    throw new Error("M-JSON input is empty.");
  }

  const inner = unwrapQuotedPayload(trimmed);

  try {
    return normalizeToRecords(JSON.parse(inner));
  } catch {
    // Single-quote JSON body (v1: no apostrophes inside string values).
  }

  const asJson = inner.replace(/'/g, '"');
  try {
    return normalizeToRecords(JSON.parse(asJson));
  } catch {
    throw new Error("Invalid M-JSON.");
  }
}

/**
 * @param {RecordRow[]} records
 * @param {{ pretty?: boolean }} [options]
 */
export function encodeJsonText(records, { pretty = true } = {}) {
  return pretty
    ? `${JSON.stringify(records, null, 2)}\n`
    : JSON.stringify(records);
}

/**
 * Decode Base64 (optionally GZip-compressed) JSON records.
 * @param {string} text
 * @param {{ gzip?: boolean }} [options]
 * @returns {Promise<RecordRow[]>}
 */
export async function parseBase64Text(text, { gzip = true } = {}) {
  let bytes = base64ToBytes(text);
  if (gzip) {
    try {
      bytes = await gunzipBytes(bytes);
    } catch (error) {
      if (
        error instanceof Error &&
        /not supported/i.test(error.message)
      ) {
        throw error;
      }
      throw new Error("Invalid GZip data.");
    }
  }
  let json;
  try {
    json = textDecoder.decode(bytes);
  } catch {
    throw new Error("Invalid Base64 payload encoding.");
  }
  return parseJsonText(json);
}

/**
 * Encode records as Base64 (optionally GZip-compressed) compact JSON.
 * @param {RecordRow[]} records
 * @param {{ gzip?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function encodeBase64Text(records, { gzip = true } = {}) {
  let bytes = textEncoder.encode(encodeJsonText(records, { pretty: false }));
  if (gzip) {
    bytes = await gzipBytes(bytes);
  }
  return bytesToBase64(bytes);
}

/**
 * Encode records as M-JSON.
 * Format (default): outer `"` on their own first/last lines, indented JSON body.
 * Compact: single-line `"…"` wrapper.
 * Original: keep `sourceJson` whitespace (falls back to Format when missing).
 * Include parsing: wrap in a `let … in` with JSON + Source (table) steps.
 * Convert quotes (single + include parsing): Text.Replace `'` → `"` before Json.Document.
 *
 * @param {RecordRow[]} records
 * @param {{
 *   quoteStyle?: QuoteStyle,
 *   formatting?: Formatting,
 *   sourceJson?: string | null,
 *   includeParsing?: boolean,
 *   convertQuotes?: boolean,
 * }} [options]
 */
export function encodeMJsonText(
  records,
  {
    quoteStyle = "escaped",
    formatting = "format",
    sourceJson = null,
    includeParsing = false,
    convertQuotes = true,
  } = {}
) {
  const original =
    formatting === "original" ? String(sourceJson ?? "").trim() : "";
  const useOriginal = Boolean(original);
  const useCompact = formatting === "compact" && !useOriginal;

  const json = useOriginal
    ? original
    : useCompact
      ? JSON.stringify(records)
      : JSON.stringify(records, null, 2);
  let body;
  if (quoteStyle === "single") {
    // Naive " → ' swap cannot distinguish apostrophes from delimiters.
    if (json.includes("'")) {
      throw new Error(
        "Single-quote M-JSON cannot include apostrophes ('). Use escaped quotes, or remove apostrophes from values and column labels."
      );
    }
    body = json.replace(/"/g, "'");
  } else {
    body = escapeMTextBody(json);
  }
  const multiline = useOriginal ? json.includes("\n") : !useCompact;
  const literal = multiline ? `"\n${body}\n"` : `"${body}"`;
  if (!includeParsing) return literal;
  return wrapMJsonWithParsing(literal, {
    convertQuotes: quoteStyle === "single" && convertQuotes,
  });
}

/**
 * Wrap an M text literal in a Power Query query that parses it to a table.
 * @param {string} mJsonLiteral
 * @param {{ convertQuotes?: boolean }} [options]
 */
export function wrapMJsonWithParsing(
  mJsonLiteral,
  { convertQuotes = false } = {}
) {
  const jsonDocument = convertQuotes
    ? `Json.Document(Text.Replace(JSON, "'", """"))`
    : "Json.Document(JSON)";
  return [
    "let",
    `    JSON = ${mJsonLiteral},`,
    `    Source = Table.FromRecords(${jsonDocument})`,
    "in",
    "    Source",
  ].join("\n");
}

/**
 * If `text` is a let-query with a `JSON = "…"` step, return that string literal;
 * otherwise return the trimmed original text.
 * @param {string} text
 */
export function extractMJsonLiteral(text) {
  const trimmed = String(text ?? "").trim();
  const marker = trimmed.match(/\bJSON\s*=\s*"/i);
  if (!marker || marker.index === undefined) return trimmed;

  const openIndex = marker.index + marker[0].length - 1;
  let i = openIndex + 1;
  let literal = '"';
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === '"') {
      if (trimmed[i + 1] === '"') {
        literal += '""';
        i += 2;
        continue;
      }
      literal += '"';
      return literal;
    }
    literal += ch;
    i += 1;
  }
  return trimmed;
}

/**
 * Parse any input format into a table + records.
 * @param {Format} format
 * @param {TableData | string | null | undefined} value
 * @param {{ gzip?: boolean }} [options]
 * @returns {Promise<{ table: TableData, records: RecordRow[] }>}
 */
export async function parseInput(format, value, { gzip = true } = {}) {
  if (format === "tabular") {
    const table = {
      columns: value?.columns ? [...value.columns] : [],
      rows: value?.rows ? [...value.rows] : [],
    };
    return { table, records: tableToRecords(table) };
  }

  const text = String(value ?? "");
  /** @type {RecordRow[]} */
  let records;
  if (format === "base64") {
    records = await parseBase64Text(text, { gzip });
  } else if (format === "m-json") {
    records = parseMJsonText(text);
  } else {
    records = parseJsonText(text);
  }
  return { table: recordsToTable(records), records };
}

/**
 * Encode records/table to the requested output format.
 * @param {Format} format
 * @param {TableData} table
 * @param {RecordRow[]} records
 * @param {{
 *   quoteStyle?: QuoteStyle,
 *   formatting?: Formatting,
 *   sourceJson?: string | null,
 *   includeParsing?: boolean,
 *   convertQuotes?: boolean,
 *   gzip?: boolean,
 * }} [options]
 * @returns {Promise<{ table: TableData, text: string | null }>}
 */
export async function encodeOutput(
  format,
  table,
  records,
  {
    quoteStyle = "escaped",
    formatting = "format",
    sourceJson = null,
    includeParsing = false,
    convertQuotes = true,
    gzip = true,
  } = {}
) {
  if (format === "tabular") {
    return { table, text: null };
  }
  if (format === "base64") {
    return {
      table,
      text: await encodeBase64Text(records, { gzip }),
    };
  }
  if (format === "m-json") {
    return {
      table,
      text: encodeMJsonText(records, {
        quoteStyle,
        formatting,
        sourceJson,
        includeParsing,
        convertQuotes,
      }),
    };
  }
  return { table, text: encodeJsonText(records) };
}

/**
 * Convert between formats.
 * @param {{
 *   inputFormat: Format,
 *   outputFormat: Format,
 *   value: TableData | string | null | undefined,
 *   quoteStyle?: QuoteStyle,
 *   formatting?: Formatting,
 *   includeParsing?: boolean,
 *   convertQuotes?: boolean,
 *   gzip?: boolean,
 * }} options
 * @returns {Promise<ConvertResult>}
 */
export async function convert({
  inputFormat,
  outputFormat,
  value,
  quoteStyle = "escaped",
  formatting = "format",
  includeParsing = false,
  convertQuotes = true,
  gzip = true,
}) {
  try {
    if (inputFormat === outputFormat) {
      return {
        ok: false,
        error: "Input and output formats must be different.",
      };
    }

    const parsed = await parseInput(inputFormat, value, { gzip });
    const sourceJson =
      formatting === "original" && inputFormat === "json"
        ? String(value ?? "").trim()
        : null;
    const encoded = await encodeOutput(
      outputFormat,
      parsed.table,
      parsed.records,
      {
        quoteStyle,
        formatting,
        sourceJson,
        includeParsing,
        convertQuotes,
        gzip,
      }
    );

    return {
      ok: true,
      table: encoded.table,
      records: parsed.records,
      text: encoded.text,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Conversion failed.",
    };
  }
}
