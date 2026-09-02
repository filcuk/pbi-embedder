/**
 * Persist tooling selection and input payloads in localStorage.
 */

import { isFormat } from "./selection.js";

/** @typedef {import("./selection.js").ToolSelection} ToolSelection */
/** @typedef {import("./convert.js").TableData} TableData */

export const TOOLING_STORAGE_KEY = "pbi-embedder-tooling";
const STORAGE_VERSION = 1;

/**
 * @typedef {{
 *   v: number,
 *   selection: Partial<ToolSelection>,
 *   inputs: {
 *     tabular?: TableData | null,
 *     json?: string,
 *     "m-json"?: string,
 *   },
 * }} PersistedTooling
 */

/**
 * @param {unknown} value
 * @returns {value is TableData}
 */
function isTableData(value) {
  if (!value || typeof value !== "object") return false;
  const table = /** @type {TableData} */ (value);
  return Array.isArray(table.columns) && Array.isArray(table.rows);
}

/**
 * @param {unknown} raw
 * @returns {PersistedTooling | null}
 */
function normalizePersisted(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = /** @type {Record<string, unknown>} */ (raw);
  if (data.v !== STORAGE_VERSION) return null;

  /** @type {Partial<ToolSelection>} */
  const selection = {};
  const sel =
    data.selection && typeof data.selection === "object"
      ? /** @type {Record<string, unknown>} */ (data.selection)
      : {};

  if (sel.family === "m" || sel.family === "dax") {
    selection.family = sel.family;
  }
  if (isFormat(sel.input)) selection.input = sel.input;
  if (isFormat(sel.output)) selection.output = sel.output;
  if (sel.quoteStyle === "single" || sel.quoteStyle === "escaped") {
    selection.quoteStyle = sel.quoteStyle;
  }
  if (typeof sel.compact === "boolean") selection.compact = sel.compact;
  if (typeof sel.includeParsing === "boolean") {
    selection.includeParsing = sel.includeParsing;
  }
  if (typeof sel.convertQuotes === "boolean") {
    selection.convertQuotes = sel.convertQuotes;
  }

  /** @type {PersistedTooling["inputs"]} */
  const inputs = {};
  const rawInputs =
    data.inputs && typeof data.inputs === "object"
      ? /** @type {Record<string, unknown>} */ (data.inputs)
      : {};

  if (isTableData(rawInputs.tabular)) {
    inputs.tabular = {
      columns: rawInputs.tabular.columns.map((column) => ({ ...column })),
      rows: rawInputs.tabular.rows.map((row) => ({
        ...row,
        cells: { ...(row.cells ?? {}) },
      })),
    };
  }
  if (typeof rawInputs.json === "string") inputs.json = rawInputs.json;
  if (typeof rawInputs["m-json"] === "string") {
    inputs["m-json"] = rawInputs["m-json"];
  }

  return { v: STORAGE_VERSION, selection, inputs };
}

/**
 * @returns {PersistedTooling | null}
 */
export function loadPersistedTooling() {
  try {
    const raw = localStorage.getItem(TOOLING_STORAGE_KEY);
    if (!raw) return null;
    return normalizePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   selection: ToolSelection,
 *   inputs: {
 *     tabular?: TableData | null,
 *     json?: string,
 *     "m-json"?: string,
 *   },
 * }} state
 */
export function savePersistedTooling(state) {
  try {
    /** @type {PersistedTooling} */
    const payload = {
      v: STORAGE_VERSION,
      selection: { ...state.selection },
      inputs: {
        tabular: state.inputs.tabular
          ? {
              columns: state.inputs.tabular.columns.map((column) => ({
                ...column,
              })),
              rows: state.inputs.tabular.rows.map((row) => ({
                ...row,
                cells: { ...(row.cells ?? {}) },
              })),
            }
          : null,
        json: String(state.inputs.json ?? ""),
        "m-json": String(state.inputs["m-json"] ?? ""),
      },
    };
    localStorage.setItem(TOOLING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}
