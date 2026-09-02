/**
 * Pure converters between tabular grid data, JSON, and M-encoded JSON.
 */

import {
  coerceCellValue,
  detectColumnType,
} from "../components/tabular-input.js";

/** @typedef {"tabular" | "json" | "m-json"} Format */
/** @typedef {"single" | "escaped"} QuoteStyle */
/** @typedef {{ id: string, label: string, type: "text" | "number" | "logical" }} Column */
/** @typedef {{ id: string, cells: Record<string, string | number | boolean | null> }} Row */
/** @typedef {{ columns: Column[], rows: Row[] }} TableData */
/** @typedef {Record<string, unknown>} RecordRow */

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
 * Turn a tabular-input snapshot into an array of records (keys = column labels).
 * @param {TableData | null | undefined} table
 * @returns {RecordRow[]}
 */
export function tableToRecords(table) {
  const columns = table?.columns ?? [];
  const rows = table?.rows ?? [];
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
 * @param {string} text
 * @returns {RecordRow[]}
 */
export function parseMJsonText(text) {
  const trimmed = String(text ?? "").trim();
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
 * @param {RecordRow[]} records
 * @param {QuoteStyle} [quoteStyle]
 */
export function encodeMJsonText(records, quoteStyle = "single") {
  const json = JSON.stringify(records);
  if (quoteStyle === "escaped") {
    return `"${escapeMTextBody(json)}"`;
  }
  return `"${json.replace(/"/g, "'")}"`;
}

/**
 * Parse any input format into a table + records.
 * @param {Format} format
 * @param {TableData | string | null | undefined} value
 * @returns {{ table: TableData, records: RecordRow[] }}
 */
export function parseInput(format, value) {
  if (format === "tabular") {
    const table = {
      columns: value?.columns ? [...value.columns] : [],
      rows: value?.rows ? [...value.rows] : [],
    };
    return { table, records: tableToRecords(table) };
  }

  const text = String(value ?? "");
  const records =
    format === "m-json" ? parseMJsonText(text) : parseJsonText(text);
  return { table: recordsToTable(records), records };
}

/**
 * Encode records/table to the requested output format.
 * @param {Format} format
 * @param {TableData} table
 * @param {RecordRow[]} records
 * @param {{ quoteStyle?: QuoteStyle }} [options]
 * @returns {{ table: TableData, text: string | null }}
 */
export function encodeOutput(format, table, records, { quoteStyle = "single" } = {}) {
  if (format === "tabular") {
    return { table, text: null };
  }
  if (format === "m-json") {
    return { table, text: encodeMJsonText(records, quoteStyle) };
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
 * }} options
 * @returns {ConvertResult}
 */
export function convert({
  inputFormat,
  outputFormat,
  value,
  quoteStyle = "single",
}) {
  try {
    if (inputFormat === outputFormat) {
      return {
        ok: false,
        error: "Input and output formats must be different.",
      };
    }

    const parsed = parseInput(inputFormat, value);
    const encoded = encodeOutput(
      outputFormat,
      parsed.table,
      parsed.records,
      { quoteStyle }
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
