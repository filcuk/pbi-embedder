/**
 * Tabular input — editable grid with typed columns (text / number / logical),
 * addable and deletable rows and columns, and inline column renaming.
 *
 * Markup:
 *   <div class="tabular-input" id="my-grid" aria-label="Inventory"></div>
 *
 * data-tabular-input-disabled — disable the grid
 *
 * Seed via init options:
 *   initTabularInput(el, {
 *     columns: [{ id?, label, type }],
 *     rows: [{ id?, cells: { [columnId]: value } }],
 *     disabled?,
 *     breakout?, // default true — allow centered canvas breakout when wide
 *     onChange?,
 *   })
 *
 * Layout: row delete on the right (trailing column); column menu (type +
 * remove) on the column label; Add column in the header after the last
 * column; Add row in a footer row under the data.
 *
 * Width: when columns exceed the page body, the grid can break out
 * centered up to the canvas (viewport minus page padding). A Fit/Overflow
 * toggle beside add-row appears only while overflowing so the user can
 * constrain to body width.
 *
 * Paste: Excel/TSV clipboard paste expands from the focused body cell
 * (fallback top-left), overwrites that rectangle, auto-detects column types.
 * Footer Paste / Paste with Headers replace the whole grid from the clipboard
 * (sized to the clipboard; optional first-row headers).
 * Reset (header): size picker for a blank text-column table.
 */

import { parseBooleanAttr, setHidden, getFocusableElements, FOCUSABLE_SELECTOR } from "../utils/dom.js";
import { createIcon } from "../utils/icons.js";
import { initToggle } from "./toggle.js";
import { initPopupMenu } from "../utils/menu.js";
import { onDocumentClickOutside, onDocumentEscape } from "../utils/document-listeners.js";
import { copyText, readText, armPasteCapture } from "../utils/clipboard.js";
import {
  prepareButtonLabelFlash,
  setButtonLabelFlash,
  flashButtonLabel,
  cancelButtonLabelFlash,
  BUTTON_LABEL_FLASH_LABEL_CLASS,
} from "../utils/button-label.js";
import { closeTooltip } from "./tooltip.js";

/** @typedef {"text" | "number" | "logical"} ColumnType */
/** @typedef {{ id: string, label: string, type: ColumnType }} Column */
/** @typedef {{ id: string, cells: Record<string, string | number | boolean | null> }} Row */

const COLUMN_TYPES = new Set(["text", "number", "logical"]);
const SIZE_PICKER_MAX_COLS = 8;
const SIZE_PICKER_MAX_ROWS = 8;
const SIZE_PICKER_DEFAULT = { cols: 3, rows: 2 };

const TYPE_OPTIONS = [
  ["text", "Text"],
  ["number", "Number"],
  ["logical", "Logical"],
];

/** @param {ColumnType | string} type */
function typeIconId(type) {
  return `type-${parseColumnType(type)}`;
}

/** Display label for a column type (`Text` / `Number` / `Logical`). */
function typeLabel(type) {
  const normalized = parseColumnType(type);
  const match = TYPE_OPTIONS.find(([value]) => value === normalized);
  return match ? match[1] : "Text";
}

/**
 * Normalize a column type string. Unknown values become `"text"`.
 * @param {unknown} raw
 * @returns {ColumnType}
 */
export function parseColumnType(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  return COLUMN_TYPES.has(value) ? /** @type {ColumnType} */ (value) : "text";
}

/**
 * Default empty cell value for a column type.
 * @param {ColumnType} type
 * @returns {string | number | boolean | null}
 */
export function defaultValueForType(type) {
  if (type === "logical") return false;
  if (type === "number") return null;
  return "";
}

/**
 * Is this a value a user could be part-way through typing in a number cell?
 * Accepts in-progress drafts such as `-`, `1,`, `1.`, and `1e-`.
 * @param {string} value
 */
export function isNumberDraft(value) {
  return /^[-+]?[\d,]*(?:\.\d*)?(?:[eE][-+]?\d*)?$/.test(value);
}

/**
 * Coerce a cell value to the target column type.
 * @param {unknown} value
 * @param {ColumnType} type
 * @returns {string | number | boolean | null}
 */
export function coerceCellValue(value, type) {
  const target = parseColumnType(type);

  if (target === "text") {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  }

  if (target === "number") {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value ? 1 : 0;
    const parsed = Number(String(value).trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  // logical
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && Number.isFinite(value);
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  if (["true", "1", "yes", "y", "on"].includes(text)) return true;
  if (["false", "0", "no", "n", "off"].includes(text)) return false;
  return Boolean(text);
}

const LOGICAL_TRUE = new Set(["true", "1", "yes", "y", "on"]);
const LOGICAL_FALSE = new Set(["false", "0", "no", "n", "off"]);

/**
 * Whether a raw clipboard/cell string parses as a finite number.
 * @param {unknown} value
 */
export function isNumericCellValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  const text = String(value).trim();
  if (!text) return false;
  return Number.isFinite(Number(text.replace(/,/g, "")));
}

/**
 * Whether a raw value is a clear logical token (non-empty).
 * @param {unknown} value
 */
export function isLogicalCellValue(value) {
  if (typeof value === "boolean") return true;
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  return LOGICAL_TRUE.has(text) || LOGICAL_FALSE.has(text);
}

/**
 * Infer column type from a list of cell values (empties ignored).
 * @param {unknown[]} values
 * @returns {ColumnType}
 */
export function detectColumnType(values) {
  const nonEmpty = (values ?? []).filter((value) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });
  if (!nonEmpty.length) return "text";
  if (nonEmpty.every(isNumericCellValue)) return "number";
  if (nonEmpty.every(isLogicalCellValue)) return "logical";
  return "text";
}

/**
 * Parse Excel-style TSV clipboard text into a rectangular string matrix.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseClipboardTable(text) {
  let normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.endsWith("\n")) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized) return [[""]];

  const rows = normalized.split("\n").map((line) => line.split("\t"));
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    const next = row.slice();
    while (next.length < width) next.push("");
    return next;
  });
}

/**
 * Format a cell value for Excel-friendly TSV.
 * @param {unknown} value
 * @param {ColumnType} [type]
 */
export function formatCellForClipboard(value, type) {
  if (value === null || value === undefined) return "";
  if (type === "logical" || typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Escape a TSV field (quote when it contains tab, newline, or quotes).
 * @param {string} value
 */
function escapeTsvCell(value) {
  const text = String(value ?? "");
  if (/[\t\n\r"]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serialize columns + rows to Excel-friendly TSV (header row + data).
 * @param {Column[]} columns
 * @param {Row[]} rows
 * @returns {string}
 */
export function formatClipboardTable(columns, rows) {
  const cols = Array.isArray(columns) ? columns : [];
  const dataRows = Array.isArray(rows) ? rows : [];
  if (!cols.length) return "";

  const header = cols.map((col) => escapeTsvCell(col.label ?? ""));
  const body = dataRows.map((row) =>
    cols.map((col) =>
      escapeTsvCell(formatCellForClipboard(row?.cells?.[col.id], col.type))
    )
  );
  return [header, ...body].map((line) => line.join("\t")).join("\n");
}

/**
 * True when clipboard text looks like a multi-cell table (TSV / multi-line).
 * @param {string} text
 */
export function isTabularClipboardText(text) {
  const value = String(text ?? "");
  if (!value) return false;
  if (value.includes("\t")) return true;
  return /[\r\n]/.test(value);
}

/**
 * Split a clipboard string matrix into column labels and data rows.
 * When `firstRowIsHeader` is true, row 0 becomes labels; otherwise labels are
 * `Column 1`…`Column N` and every row is data.
 * @param {string[][]} matrix
 * @param {{ firstRowIsHeader?: boolean }} [options]
 * @returns {{ labels: string[], data: string[][] } | null}
 */
export function splitClipboardMatrix(matrix, { firstRowIsHeader = false } = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) return null;
  const width = matrix[0]?.length ?? 0;
  if (!width) return null;

  /** @param {string[]} row */
  function padRow(row) {
    const next = row.slice(0, width);
    while (next.length < width) next.push("");
    return next;
  }

  if (firstRowIsHeader) {
    const labels = matrix[0].map((cell, index) => {
      const label = String(cell ?? "").trim();
      return label || `Column ${index + 1}`;
    });
    return {
      labels,
      data: matrix.slice(1).map(padRow),
    };
  }

  return {
    labels: Array.from(
      { length: width },
      (_, index) => `Column ${index + 1}`
    ),
    data: matrix.map(padRow),
  };
}


function resolveDisabled(rootEl, disabledOption) {
  if (typeof disabledOption === "boolean") return disabledOption;
  return parseBooleanAttr(rootEl?.dataset.tabularInputDisabled) ?? false;
}

function createIdFactory() {
  let seq = 0;
  return (prefix) => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
}

/**
 * @param {unknown} columns
 * @param {(prefix: string) => string} nextId
 * @returns {Column[]}
 */
function normalizeColumns(columns, nextId) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return [{ id: nextId("col"), label: "Column 1", type: "text" }];
  }
  return columns.map((col, index) => {
    const raw = col && typeof col === "object" ? col : {};
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : nextId("col");
    const label =
      typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim()
        : `Column ${index + 1}`;
    return { id, label, type: parseColumnType(raw.type) };
  });
}

/**
 * @param {unknown} rows
 * @param {Column[]} columns
 * @param {(prefix: string) => string} nextId
 * @returns {Row[]}
 */
function normalizeRows(rows, columns, nextId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      {
        id: nextId("row"),
        cells: Object.fromEntries(
          columns.map((col) => [col.id, defaultValueForType(col.type)])
        ),
      },
    ];
  }
  return rows.map((row) => {
    const raw = row && typeof row === "object" ? row : {};
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : nextId("row");
    const cells = {};
    const source =
      raw.cells && typeof raw.cells === "object" && !Array.isArray(raw.cells)
        ? raw.cells
        : {};
    for (const col of columns) {
      cells[col.id] =
        col.id in source
          ? coerceCellValue(source[col.id], col.type)
          : defaultValueForType(col.type);
    }
    return { id, cells };
  });
}

/**
 * @param {HTMLElement | null} rootEl
 */
export function initTabularInput(
  rootEl,
  {
    columns: columnsOption,
    rows: rowsOption,
    disabled,
    breakout: breakoutOption,
    onChange,
  } = {}
) {
  if (!rootEl) return null;

  const nextId = createIdFactory();
  let isDisabled = resolveDisabled(rootEl, disabled);
  /** User preference: allow centered canvas breakout when the grid overflows. */
  let breakoutEnabled =
    typeof breakoutOption === "boolean"
      ? breakoutOption
      : (parseBooleanAttr(rootEl.dataset.tabularInputBreakout) ?? true);
  /** Whether content is wider than the page-body slot. */
  let isOverflowing = false;
  /** @type {number | null} */
  let breakoutSyncFrame = null;

  /** @type {Column[]} */
  let columns = normalizeColumns(columnsOption, nextId);
  /** @type {Row[]} */
  let rows = normalizeRows(rowsOption, columns, nextId);

  /** @type {Map<string, string>} */
  const renameDrafts = new Map();
  /** @type {{ destroy: () => void }[]} */
  let typeMenus = [];

  const wrapEl = document.createElement("div");
  wrapEl.className = "table-wrap tabular-input-wrap";

  const tableEl = document.createElement("table");
  tableEl.className = "table table--compact tabular-input-table";

  const theadEl = document.createElement("thead");
  const tbodyEl = document.createElement("tbody");
  tableEl.append(theadEl, tbodyEl);
  wrapEl.append(tableEl);

  const breakoutBtn = document.createElement("button");
  breakoutBtn.type = "button";
  breakoutBtn.className = "btn tabular-input-breakout-toggle";
  breakoutBtn.setAttribute("aria-pressed", "true");
  setHidden(breakoutBtn, true);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-label-flash tabular-input-copy";
  copyBtn.setAttribute("aria-label", "Copy table");
  copyBtn.dataset.tooltip = "Copy in tabular format";
  const copyLabelEl = document.createElement("span");
  copyLabelEl.className = BUTTON_LABEL_FLASH_LABEL_CLASS;
  copyLabelEl.textContent = "Copy";
  copyBtn.append(
    createIcon("copy", { className: "btn-icon-svg" }),
    copyLabelEl
  );

  const pasteBtn = document.createElement("button");
  pasteBtn.type = "button";
  pasteBtn.className = "btn btn-label-flash tabular-input-paste";
  pasteBtn.setAttribute("aria-label", "Paste table");
  pasteBtn.dataset.tooltip = "Replace table from clipboard";
  const pasteLabelEl = document.createElement("span");
  pasteLabelEl.className = BUTTON_LABEL_FLASH_LABEL_CLASS;
  pasteLabelEl.textContent = "Paste";
  pasteBtn.append(
    createIcon("paste", { className: "btn-icon-svg" }),
    pasteLabelEl
  );

  const pasteHeadersBtn = document.createElement("button");
  pasteHeadersBtn.type = "button";
  pasteHeadersBtn.className = "btn btn-label-flash tabular-input-paste-headers";
  pasteHeadersBtn.setAttribute("aria-label", "Paste with headers");
  pasteHeadersBtn.dataset.tooltip =
    "Replace table from clipboard; first row becomes column headers";
  const pasteHeadersLabelEl = document.createElement("span");
  pasteHeadersLabelEl.className = BUTTON_LABEL_FLASH_LABEL_CLASS;
  pasteHeadersLabelEl.textContent = "Paste with Headers";
  pasteHeadersBtn.append(
    createIcon("paste-special", { className: "btn-icon-svg" }),
    pasteHeadersLabelEl
  );

  prepareButtonLabelFlash(copyBtn, {
    idle: "Copy",
  });
  prepareButtonLabelFlash(pasteBtn, {
    idle: "Paste",
    success: "Pasted",
    measureLabels: ["Ctrl+V"],
  });
  prepareButtonLabelFlash(pasteHeadersBtn, {
    idle: "Paste with Headers",
    success: "Pasted",
    measureLabels: ["Ctrl+V"],
  });

  const addRowBtn = document.createElement("button");
  addRowBtn.type = "button";
  addRowBtn.className = "btn btn-icon tabular-input-add-row";
  addRowBtn.setAttribute("aria-label", "Add row");
  addRowBtn.dataset.tooltip = "Add row";
  addRowBtn.append(createIcon("plus", { className: "btn-icon-svg" }));

  const footerActions = document.createElement("div");
  footerActions.className = "tabular-input-footer-actions";
  footerActions.append(breakoutBtn, copyBtn, pasteBtn, pasteHeadersBtn);

  const addColBtn = document.createElement("button");
  addColBtn.type = "button";
  addColBtn.className = "btn btn-icon tabular-input-add-column";
  addColBtn.setAttribute("aria-label", "Add column");
  addColBtn.dataset.tooltip = "Add column";
  addColBtn.append(createIcon("plus", { className: "btn-icon-svg" }));

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-danger btn-icon tabular-input-reset";
  resetBtn.setAttribute("aria-label", "Reset table");
  resetBtn.dataset.tooltip = "Reset table";
  resetBtn.setAttribute("aria-haspopup", "dialog");
  resetBtn.setAttribute("aria-expanded", "false");
  resetBtn.append(createIcon("delete", { className: "btn-icon-svg" }));

  const resetSizeLabelId = `tabular-input-reset-size-${nextId("dlg")}`;
  const resetSlot = document.createElement("div");
  resetSlot.className = "tabular-input-reset-slot";

  const sizePopover = document.createElement("div");
  sizePopover.className = "tabular-input-size-popover hidden";
  sizePopover.setAttribute("role", "dialog");
  sizePopover.setAttribute("aria-label", "Choose table size");
  sizePopover.hidden = true;

  const sizePickerLabel = document.createElement("div");
  sizePickerLabel.id = resetSizeLabelId;
  sizePickerLabel.className = "tabular-input-size-picker-label";
  sizePickerLabel.setAttribute("aria-live", "polite");

  const sizePicker = document.createElement("div");
  sizePicker.className = "tabular-input-size-picker";
  sizePicker.setAttribute("role", "grid");
  sizePicker.setAttribute("aria-label", "Table size");
  sizePicker.setAttribute("aria-describedby", resetSizeLabelId);

  /** @type {HTMLButtonElement[]} */
  const sizePickerCells = [];
  let sizePickerCols = SIZE_PICKER_DEFAULT.cols;
  let sizePickerRows = SIZE_PICKER_DEFAULT.rows;
  let sizePopoverOpen = false;

  for (let row = 1; row <= SIZE_PICKER_MAX_ROWS; row += 1) {
    const rowEl = document.createElement("div");
    rowEl.className = "tabular-input-size-picker-row";
    rowEl.setAttribute("role", "row");
    for (let col = 1; col <= SIZE_PICKER_MAX_COLS; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "tabular-input-size-picker-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.cols = String(col);
      cell.dataset.rows = String(row);
      cell.setAttribute("aria-label", `${col} by ${row}`);
      rowEl.append(cell);
      sizePickerCells.push(cell);
    }
    sizePicker.append(rowEl);
  }

  sizePopover.append(sizePickerLabel, sizePicker);
  resetSlot.append(resetBtn, sizePopover);

  const liveEl = document.createElement("div");
  liveEl.className = "tabular-input-live";
  liveEl.setAttribute("aria-live", "polite");

  rootEl.replaceChildren(wrapEl, liveEl);
  rootEl.classList.add("tabular-input");

  function setSizePickerHighlight(cols, rows) {
    sizePickerCols = cols;
    sizePickerRows = rows;
    sizePickerLabel.textContent = `${cols} × ${rows}`;
    for (const cell of sizePickerCells) {
      const c = Number(cell.dataset.cols);
      const r = Number(cell.dataset.rows);
      const inRange = c <= cols && r <= rows;
      const isCorner = c === cols && r === rows;
      cell.classList.toggle("is-selected", inRange);
      cell.setAttribute("aria-selected", isCorner ? "true" : "false");
      cell.tabIndex = isCorner ? 0 : -1;
    }
  }

  function clearSizePopoverPosition() {
    sizePopover.style.position = "";
    sizePopover.style.top = "";
    sizePopover.style.left = "";
    sizePopover.style.right = "";
    sizePopover.style.bottom = "";
    sizePopover.style.zIndex = "";
  }

  function positionSizePopover() {
    const rect = resetBtn.getBoundingClientRect();
    const gap = 4;
    const padding = 8;
    const viewportWidth = document.documentElement.clientWidth;

    sizePopover.style.position = "fixed";
    sizePopover.style.zIndex = "200";
    sizePopover.style.bottom = "auto";
    sizePopover.style.right = "auto";
    sizePopover.style.top = `${rect.bottom + gap}px`;
    sizePopover.style.left = `${rect.left}px`;

    const placed = sizePopover.getBoundingClientRect();
    if (placed.bottom > window.innerHeight - padding) {
      sizePopover.style.top = `${Math.max(padding, rect.top - placed.height - gap)}px`;
    }
    const placedX = sizePopover.getBoundingClientRect();
    if (placedX.right > viewportWidth - padding) {
      sizePopover.style.left = `${Math.max(padding, viewportWidth - placedX.width - padding)}px`;
    }
    if (placedX.left < padding) {
      sizePopover.style.left = `${padding}px`;
    }
  }

  function closeSizePopover() {
    if (!sizePopoverOpen) return;
    sizePopoverOpen = false;
    setHidden(sizePopover, true);
    clearSizePopoverPosition();
    resetBtn.setAttribute("aria-expanded", "false");
    resetBtn.focus();
  }

  function openSizePopover() {
    for (const menu of typeMenus) menu.closeMenu();
    setSizePickerHighlight(SIZE_PICKER_DEFAULT.cols, SIZE_PICKER_DEFAULT.rows);
    sizePopoverOpen = true;
    setHidden(sizePopover, false);
    resetBtn.setAttribute("aria-expanded", "true");
    positionSizePopover();
    const corner = sizePicker.querySelector(
      '.tabular-input-size-picker-cell[aria-selected="true"]'
    );
    if (corner instanceof HTMLButtonElement) corner.focus();
  }

  function applySizePickerSelection() {
    resetToBlank({
      columnCount: sizePickerCols,
      rowCount: sizePickerRows,
    });
    closeSizePopover();
  }

  sizePicker.addEventListener("pointerover", (event) => {
    const cell = event.target.closest(".tabular-input-size-picker-cell");
    if (!(cell instanceof HTMLButtonElement) || !sizePicker.contains(cell)) {
      return;
    }
    setSizePickerHighlight(Number(cell.dataset.cols), Number(cell.dataset.rows));
  });

  sizePicker.addEventListener("pointerleave", () => {
    setSizePickerHighlight(SIZE_PICKER_DEFAULT.cols, SIZE_PICKER_DEFAULT.rows);
  });

  sizePicker.addEventListener("click", (event) => {
    const cell = event.target.closest(".tabular-input-size-picker-cell");
    if (!(cell instanceof HTMLButtonElement) || !sizePicker.contains(cell)) {
      return;
    }
    setSizePickerHighlight(Number(cell.dataset.cols), Number(cell.dataset.rows));
    applySizePickerSelection();
  });

  sizePicker.addEventListener("keydown", (event) => {
    if (!sizePopoverOpen) return;
    const current = sizePicker.querySelector(
      '.tabular-input-size-picker-cell[aria-selected="true"]'
    );
    if (!(current instanceof HTMLButtonElement)) return;

    let cols = Number(current.dataset.cols);
    let rows = Number(current.dataset.rows);
    if (event.key === "ArrowRight") cols = Math.min(SIZE_PICKER_MAX_COLS, cols + 1);
    else if (event.key === "ArrowLeft") cols = Math.max(1, cols - 1);
    else if (event.key === "ArrowDown") rows = Math.min(SIZE_PICKER_MAX_ROWS, rows + 1);
    else if (event.key === "ArrowUp") rows = Math.max(1, rows - 1);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      applySizePickerSelection();
      return;
    } else {
      return;
    }

    event.preventDefault();
    setSizePickerHighlight(cols, rows);
    const next = sizePicker.querySelector(
      `.tabular-input-size-picker-cell[data-cols="${cols}"][data-rows="${rows}"]`
    );
    if (next instanceof HTMLButtonElement) next.focus();
  });

  setSizePickerHighlight(SIZE_PICKER_DEFAULT.cols, SIZE_PICKER_DEFAULT.rows);

  const removeSizePopoverOutside = onDocumentClickOutside((event) => {
    if (!sizePopoverOpen) return;
    if (resetSlot.contains(event.target)) return;
    closeSizePopover();
  });

  const removeSizePopoverEscape = onDocumentEscape(() => {
    if (!sizePopoverOpen) return false;
    closeSizePopover();
    return true;
  }, { priority: 50 });

  function onSizePopoverViewportChange() {
    if (sizePopoverOpen) closeSizePopover();
  }

  window.addEventListener("scroll", onSizePopoverViewportChange, true);
  window.addEventListener("resize", onSizePopoverViewportChange);

  function snapshot() {
    return {
      columns: columns.map((col) => ({ ...col })),
      rows: rows.map((row) => ({
        id: row.id,
        cells: { ...row.cells },
      })),
    };
  }

  function emit(source) {
    const data = snapshot();
    onChange?.({
      rootEl,
      columns: data.columns,
      rows: data.rows,
      source,
    });
  }

  function announce(message) {
    liveEl.textContent = "";
    // Force a live region update when the same message repeats.
    requestAnimationFrame(() => {
      liveEl.textContent = message;
    });
  }

  /**
   * Active “press Ctrl+V” capture when Clipboard API read is unavailable.
   * @type {{
   *   button: HTMLButtonElement,
   *   reset: () => void,
   *   capture: ReturnType<typeof armPasteCapture>,
   * } | null}
   */
  let pasteCaptureSession = null;

  function syncDisabled() {
    rootEl.classList.toggle("tabular-input--disabled", isDisabled);
    addRowBtn.disabled = isDisabled;
    addColBtn.disabled = isDisabled;
    resetBtn.disabled = isDisabled;
    breakoutBtn.disabled = isDisabled;
    copyBtn.disabled = isDisabled;
    pasteBtn.disabled = isDisabled;
    pasteHeadersBtn.disabled = isDisabled;
  }

  function getSlotWidth() {
    const slot = rootEl.parentElement;
    return slot?.clientWidth ?? rootEl.clientWidth;
  }

  function getCanvasMaxWidth() {
    const main = rootEl.closest("main");
    let pad = 0;
    if (main) {
      const style = getComputedStyle(main);
      pad =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
    }
    if (!pad) {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;width:var(--page-padding-x)";
      document.body.append(probe);
      pad = probe.offsetWidth * 2;
      probe.remove();
    }
    return Math.max(0, document.documentElement.clientWidth - pad);
  }

  function syncBreakoutButton() {
    const active = isOverflowing && breakoutEnabled;
    const shortLabel = active ? "Fit" : "Overflow";
    const tip = active ? "Fit to page width" : "Expand to canvas width";
    breakoutBtn.setAttribute("aria-pressed", active ? "true" : "false");
    breakoutBtn.setAttribute("aria-label", tip);
    breakoutBtn.dataset.tooltip = tip;
    const iconId = active ? "fullscreen-exit" : "fullscreen";
    const labelEl = document.createElement("span");
    labelEl.className = "tabular-input-breakout-label";
    labelEl.textContent = shortLabel;
    breakoutBtn.replaceChildren(
      createIcon(iconId, { className: "btn-icon-svg" }),
      labelEl
    );
  }

  function getWrapBorderX() {
    const style = getComputedStyle(wrapEl);
    return (
      (parseFloat(style.borderLeftWidth) || 0) +
      (parseFloat(style.borderRightWidth) || 0)
    );
  }

  function clearBreakoutStyles() {
    rootEl.classList.remove("tabular-input--breakout");
    rootEl.style.removeProperty("--tabular-breakout-width");
    rootEl.style.removeProperty("width");
    rootEl.style.removeProperty("max-width");
    rootEl.style.removeProperty("margin-left");
    wrapEl.style.removeProperty("overflow-x");
  }

  function syncBreakoutLayout() {
    breakoutSyncFrame = null;

    // Measure against the page-body slot without breakout applied.
    clearBreakoutStyles();
    const slotWidth = getSlotWidth();
    const contentWidth = Math.max(tableEl.scrollWidth, wrapEl.scrollWidth);
    isOverflowing = contentWidth > slotWidth + 1;

    setHidden(breakoutBtn, !isOverflowing);
    syncBreakoutButton();

    if (!isOverflowing || !breakoutEnabled) return;

    // Include .table-wrap borders so the table fits without a 1–2px scrollbar.
    const needed = Math.ceil(contentWidth + getWrapBorderX());
    const canvasMax = getCanvasMaxWidth();
    const width = Math.min(needed, canvasMax);
    rootEl.style.setProperty("--tabular-breakout-width", `${width}px`);
    rootEl.style.width = `${width}px`;
    rootEl.style.maxWidth = `calc(100vw - 2 * var(--page-padding-x))`;
    rootEl.style.marginLeft = `calc((100% - ${width}px) / 2)`;
    rootEl.classList.add("tabular-input--breakout");
    // Hide residual subpixel overflow when we sized to fit; keep scroll if clamped.
    wrapEl.style.overflowX = needed <= canvasMax ? "hidden" : "";
  }

  function scheduleBreakoutSync() {
    if (breakoutSyncFrame !== null) return;
    breakoutSyncFrame = requestAnimationFrame(() => {
      syncBreakoutLayout();
    });
  }

  /**
   * @param {Column} column
   * @param {Row} row
   * @param {number} rowIndex
   */
  function createCellControl(column, row, rowIndex) {
    const value = row.cells[column.id];

    if (column.type === "logical") {
      const toggleEl = document.createElement("div");
      toggleEl.className = "toggle toggle--slim tabular-input-logical";

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "toggle-btn";
      toggleBtn.setAttribute("role", "switch");
      toggleBtn.setAttribute(
        "aria-checked",
        value ? "true" : "false"
      );
      toggleBtn.setAttribute(
        "aria-label",
        `${column.label}, row ${rowIndex + 1}`
      );
      toggleBtn.dataset.tabularInputCell = "";
      toggleBtn.dataset.rowId = row.id;
      toggleBtn.dataset.columnId = column.id;

      const track = document.createElement("span");
      track.className = "toggle-track";
      track.setAttribute("aria-hidden", "true");
      const thumb = document.createElement("span");
      thumb.className = "toggle-thumb";
      track.append(thumb);
      toggleBtn.append(track);

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.className = "toggle-value";
      hiddenInput.value = value ? "true" : "false";

      toggleEl.append(toggleBtn, hiddenInput);

      initToggle(toggleEl, {
        defaultChecked: Boolean(value),
        disabled: isDisabled,
        onChange: ({ checked, source }) => {
          if (isDisabled || source === "init") return;
          row.cells[column.id] = checked;
          emit("input");
        },
      });

      return toggleEl;
    }

    const input = document.createElement("input");
    input.className = "input tabular-input-cell";
    input.disabled = isDisabled;
    input.dataset.tabularInputCell = "";
    input.dataset.rowId = row.id;
    input.dataset.columnId = column.id;
    input.setAttribute("aria-label", `${column.label}, row ${rowIndex + 1}`);

    // Number cells stay type="text" so arrow keys can walk the caret through
    // digits; type="number" hides the caret position from scripts.
    input.type = "text";
    input.value = value === null || value === undefined ? "" : String(value);
    if (column.type === "number") {
      input.inputMode = "decimal";
      input.classList.add("tabular-input-cell--number");
    }

    let numberDraft = input.value;

    input.addEventListener("input", () => {
      if (isDisabled) return;
      if (column.type === "number") {
        if (!isNumberDraft(input.value)) {
          const shift = input.value.length - numberDraft.length;
          const caret = Math.min(
            Math.max((input.selectionStart ?? input.value.length) - shift, 0),
            numberDraft.length
          );
          input.value = numberDraft;
          input.setSelectionRange(caret, caret);
          return;
        }
        numberDraft = input.value;
        if (input.value.trim() === "") {
          row.cells[column.id] = null;
        } else {
          const parsed = Number(input.value.replace(/,/g, ""));
          if (Number.isFinite(parsed)) {
            row.cells[column.id] = parsed;
          }
        }
      } else {
        row.cells[column.id] = input.value;
      }
      emit("input");
    });

    input.addEventListener("blur", () => {
      if (isDisabled || column.type !== "number") return;
      const next = coerceCellValue(input.value, "number");
      const previous = row.cells[column.id];
      row.cells[column.id] = next;
      input.value = next === null ? "" : String(next);
      numberDraft = input.value;
      if (previous !== next) emit("input");
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      const nextRow = rows[rowIndex + 1];
      if (!nextRow) return;
      const next = tbodyEl.querySelector(
        `[data-row-id="${CSS.escape(nextRow.id)}"][data-column-id="${CSS.escape(column.id)}"]`
      );
      if (next instanceof HTMLElement) next.focus();
    });

    return input;
  }

  /**
   * @param {Column} column
   */
  function createHeaderCell(column) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "tabular-input-col-header";
    th.dataset.columnId = column.id;

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "tabular-input-col-label";
    labelInput.value = column.label;
    labelInput.disabled = isDisabled;
    labelInput.size = 1;
    labelInput.setAttribute("aria-label", "Column name");
    labelInput.dataset.tabularInputRename = "";
    labelInput.dataset.columnId = column.id;
    if (!isDisabled) {
      labelInput.dataset.tooltip = "Select to edit";
    }

    const field = document.createElement("div");
    field.className = "tabular-input-col-field";

    labelInput.addEventListener("focus", () => {
      field.classList.add("is-editing");
      delete labelInput.dataset.tooltip;
      closeTooltip();
      renameDrafts.set(column.id, column.label);
    });

    labelInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const previous = renameDrafts.get(column.id) ?? column.label;
        labelInput.value = previous;
        labelInput.blur();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        labelInput.blur();
      }
    });

    labelInput.addEventListener("blur", () => {
      field.classList.remove("is-editing");
      if (!isDisabled) {
        labelInput.dataset.tooltip = "Select to edit";
      }
      if (isDisabled) return;
      const previous = renameDrafts.get(column.id) ?? column.label;
      const next = labelInput.value.trim() || previous;
      labelInput.value = next;
      renameDrafts.delete(column.id);
      if (next === column.label) return;
      column.label = next;
      emit("rename");
      announce(`Column renamed to ${next}`);
      tbodyEl
        .querySelectorAll(`[data-column-id="${CSS.escape(column.id)}"]`)
        .forEach((el, index) => {
          if (el instanceof HTMLElement) {
            el.setAttribute("aria-label", `${column.label}, row ${index + 1}`);
          }
        });
      const typeTriggerEl = th.querySelector(".tabular-input-type-trigger");
      if (typeTriggerEl) {
        typeTriggerEl.setAttribute("aria-label", `Options for ${column.label}`);
        typeTriggerEl.dataset.tooltip = `${typeLabel(column.type)} type`;
      }
      const removeBtn = th.querySelector("[data-tabular-input-remove-column]");
      if (removeBtn) {
        removeBtn.setAttribute("aria-label", `Delete column ${column.label}`);
      }
    });

    const menuId = `tabular-input-col-menu-${column.id}`;

    const typeTrigger = document.createElement("button");
    typeTrigger.type = "button";
    typeTrigger.className = "tabular-input-type-trigger dropdown-trigger";
    typeTrigger.disabled = isDisabled;
    typeTrigger.setAttribute("aria-label", `Options for ${column.label}`);
    typeTrigger.dataset.tooltip = `${typeLabel(column.type)} type`;
    typeTrigger.setAttribute("aria-haspopup", "menu");
    typeTrigger.setAttribute("aria-expanded", "false");
    typeTrigger.setAttribute("aria-controls", menuId);
    typeTrigger.dataset.columnId = column.id;
    typeTrigger.append(
      createIcon(typeIconId(column.type), {
        className: "tabular-input-type-current-icon",
      }),
      createIcon("chevron-down", { className: "tabular-input-type-icon" })
    );

    const typeMenu = document.createElement("ul");
    typeMenu.id = menuId;
    typeMenu.className = "dropdown-menu tabular-input-type-menu hidden";
    typeMenu.setAttribute("role", "menu");
    setHidden(typeMenu, true);

    const typeGroupLi = document.createElement("li");
    typeGroupLi.setAttribute("role", "presentation");
    const typeGroup = document.createElement("div");
    typeGroup.className = "dropdown-menu-group";
    typeGroup.textContent = "Type";
    typeGroupLi.append(typeGroup);
    typeMenu.append(typeGroupLi);

    for (const [value, text] of TYPE_OPTIONS) {
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "dropdown-menu-item tabular-input-type-item";
      item.setAttribute("role", "menuitem");
      item.dataset.value = value;
      item.append(
        createIcon(typeIconId(value), {
          className: "tabular-input-type-item-icon",
        })
      );
      const label = document.createElement("span");
      label.className = "tabular-input-type-item-label";
      label.textContent = text;
      item.append(label);
      if (value === column.type) item.classList.add("is-selected");
      li.append(item);
      typeMenu.append(li);
    }

    const columnGroupLi = document.createElement("li");
    columnGroupLi.setAttribute("role", "presentation");
    const columnGroup = document.createElement("div");
    columnGroup.className = "dropdown-menu-group";
    columnGroup.textContent = "Column";
    columnGroupLi.append(columnGroup);
    typeMenu.append(columnGroupLi);

    for (const [value, text, iconId] of [
      ["remove-column", "Remove", "remove"],
      ["add-column-before", "Add before", "plus"],
      ["add-column-after", "Add after", "plus"],
    ]) {
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "dropdown-menu-item tabular-input-type-item";
      item.setAttribute("role", "menuitem");
      item.dataset.value = value;
      if (value === "remove-column") {
        item.classList.add("tabular-input-remove-column");
        item.dataset.tabularInputRemoveColumn = "";
        item.setAttribute("aria-label", `Delete column ${column.label}`);
      }
      item.append(
        createIcon(iconId, { className: "tabular-input-type-item-icon" })
      );
      const label = document.createElement("span");
      label.className = "tabular-input-type-item-label";
      label.textContent = text;
      item.append(label);
      li.append(item);
      typeMenu.append(li);
    }

    const typeSlot = document.createElement("div");
    typeSlot.className = "tabular-input-type-slot dropdown";
    typeSlot.append(typeTrigger, typeMenu);

    const typeMenuApi = initPopupMenu({
      containerEl: typeSlot,
      menuEl: typeMenu,
      toggleEl: typeTrigger,
      itemSelector: ".dropdown-menu-item",
      fixed: true,
      fixedAlign: "end",
      onSelect: ({ value }) => {
        if (isDisabled) return;
        if (value === "remove-column") {
          removeColumn(column.id, { source: "remove-column" });
          return;
        }
        if (value === "add-column-before" || value === "add-column-after") {
          const at = columns.findIndex((col) => col.id === column.id);
          if (at < 0) return;
          addColumn(
            {},
            {
              index: value === "add-column-before" ? at : at + 1,
              source: "add-column",
            }
          );
          return;
        }
        const nextType = parseColumnType(value);
        if (nextType === column.type) return;
        column.type = nextType;
        for (const row of rows) {
          row.cells[column.id] = coerceCellValue(row.cells[column.id], nextType);
        }
        render();
        emit("type-change");
        announce(`Column ${column.label} type set to ${nextType}`);
      },
    });
    if (typeMenuApi) {
      typeMenus.push(typeMenuApi);
      // Close sibling column menus before this one toggles (only one open at a time).
      typeTrigger.addEventListener(
        "click",
        () => {
          closeSizePopover();
          for (const menu of typeMenus) {
            if (menu !== typeMenuApi) menu.closeMenu();
          }
        },
        true
      );
    }

    field.append(labelInput, typeSlot);
    th.append(field);
    return th;
  }

  function createRowActionsHeader() {
    const actionsTh = document.createElement("th");
    actionsTh.scope = "col";
    actionsTh.className = "tabular-input-row-move-col";
    actionsTh.append(resetSlot);
    return actionsTh;
  }

  function createTrailingHeader() {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "tabular-input-trailing-col";
    th.append(addColBtn);
    return th;
  }

  function createRowMoveCell(row, rowIndex) {
    const td = document.createElement("td");
    td.className = "tabular-input-row-move-col";

    const split = document.createElement("div");
    split.className = "tabular-input-row-move";
    split.setAttribute("role", "group");
    split.setAttribute("aria-label", `Move row ${rowIndex + 1}`);

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "tabular-input-row-move-btn";
    upBtn.tabIndex = -1;
    upBtn.dataset.tabularInputChrome = "move-row";
    upBtn.setAttribute("aria-label", `Move row ${rowIndex + 1} up`);
    upBtn.disabled = isDisabled || rowIndex === 0;
    upBtn.append(
      createIcon("chevron-up", { className: "tabular-input-row-move-icon" })
    );
    upBtn.addEventListener("click", () => {
      moveRow(row.id, { delta: -1, source: "move-row" });
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "tabular-input-row-move-btn";
    downBtn.tabIndex = -1;
    downBtn.dataset.tabularInputChrome = "move-row";
    downBtn.setAttribute("aria-label", `Move row ${rowIndex + 1} down`);
    downBtn.disabled = isDisabled || rowIndex >= rows.length - 1;
    downBtn.append(
      createIcon("chevron-down", { className: "tabular-input-row-move-icon" })
    );
    downBtn.addEventListener("click", () => {
      moveRow(row.id, { delta: 1, source: "move-row" });
    });

    split.append(upBtn, downBtn);
    td.append(split);
    return td;
  }

  function createTrailingRemoveCell(row, rowIndex) {
    const td = document.createElement("td");
    td.className = "tabular-input-trailing-col";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-icon tabular-input-remove-row";
    removeBtn.disabled = isDisabled;
    removeBtn.setAttribute("aria-label", `Delete row ${rowIndex + 1}`);
    removeBtn.dataset.tooltip = "Remove row";
    removeBtn.append(createIcon("remove", { className: "btn-icon-svg" }));
    removeBtn.addEventListener("click", () => {
      removeRow(row.id, { source: "remove-row" });
    });

    td.append(removeBtn);
    return td;
  }

  function createTrailingSpacerCell() {
    const td = document.createElement("td");
    td.className = "tabular-input-trailing-col";
    return td;
  }

  function createAddRowFooter() {
    const tr = document.createElement("tr");
    tr.className = "tabular-input-add-row-tr";

    const lead = document.createElement("td");
    lead.className = "tabular-input-row-move-col";
    lead.append(addRowBtn);

    const cell = document.createElement("td");
    cell.className = "tabular-input-add-row-cell";
    cell.colSpan = Math.max(columns.length, 1);
    cell.append(footerActions);

    tr.append(lead, cell, createTrailingSpacerCell());
    return tr;
  }

  function createHeaderGapRow() {
    const tr = document.createElement("tr");
    tr.className = "tabular-input-header-gap";
    tr.setAttribute("aria-hidden", "true");

    const td = document.createElement("td");
    td.colSpan = Math.max(columns.length, 1) + 2;
    tr.append(td);
    return tr;
  }

  function render() {
    closeTooltip();
    for (const menu of typeMenus) menu.destroy();
    typeMenus = [];
    syncDisabled();
    theadEl.replaceChildren();
    tbodyEl.replaceChildren();

    const headerRow = document.createElement("tr");
    headerRow.append(createRowActionsHeader());
    for (const column of columns) {
      headerRow.append(createHeaderCell(column));
    }
    headerRow.append(createTrailingHeader());
    theadEl.append(headerRow);

    tbodyEl.append(createHeaderGapRow());

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      tr.dataset.rowId = row.id;
      tr.append(createRowMoveCell(row, rowIndex));

      for (const column of columns) {
        const td = document.createElement("td");
        if (column.type === "number") td.classList.add("table-num");
        if (column.type === "logical") {
          td.classList.add("tabular-input-logical-cell");
        }
        td.append(createCellControl(column, row, rowIndex));
        tr.append(td);
      }

      tr.append(createTrailingRemoveCell(row, rowIndex));
      tbodyEl.append(tr);
    });

    tbodyEl.append(createAddRowFooter());
    scheduleBreakoutSync();
  }

  /**
   * Focus the rename field for a column (selects label text for quick edit).
   * @param {string} columnId
   */
  function focusColumnRename(columnId) {
    const input = theadEl.querySelector(
      `.tabular-input-col-label[data-column-id="${CSS.escape(columnId)}"]`
    );
    if (!(input instanceof HTMLInputElement)) return;
    input.focus();
    input.select();
    input.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /**
   * Focus the first body cell of a row.
   * @param {string} rowId
   */
  function focusRowFirstCell(rowId) {
    const firstCol = columns[0];
    if (!firstCol) return;
    const cell = tbodyEl.querySelector(
      `[data-tabular-input-cell][data-row-id="${CSS.escape(rowId)}"][data-column-id="${CSS.escape(firstCol.id)}"]`
    );
    if (!(cell instanceof HTMLElement)) return;
    cell.focus();
    cell.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /**
   * Focus the delete-row button for a row by index.
   * @param {number} rowIndex
   */
  function focusRowDelete(rowIndex) {
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    const row = rows[rowIndex];
    const btn = tbodyEl.querySelector(
      `tr[data-row-id="${CSS.escape(row.id)}"] .tabular-input-remove-row`
    );
    if (!(btn instanceof HTMLElement)) return;
    btn.focus();
    btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function addRow({ emitEvent = true, source = "add-row" } = {}) {
    if (isDisabled) return null;
    const row = {
      id: nextId("row"),
      cells: Object.fromEntries(
        columns.map((col) => [col.id, defaultValueForType(col.type)])
      ),
    };
    rows.push(row);
    render();
    focusRowFirstCell(row.id);
    if (emitEvent) {
      emit(source);
      announce("Row added");
    }
    return row.id;
  }

  function removeRow(rowId, { emitEvent = true, source = "remove-row" } = {}) {
    if (isDisabled) return;
    const index = rows.findIndex((row) => row.id === rowId);
    if (index < 0) return;
    rows = rows.filter((row) => row.id !== rowId);
    render();
    // Keep focus on the delete control at this index (next row slid up),
    // or the new last row if the deleted row was last.
    if (rows.length) {
      focusRowDelete(Math.min(index, rows.length - 1));
    }
    if (emitEvent) {
      emit(source);
      announce("Row deleted");
    }
  }

  function moveRow(
    rowId,
    { delta = 0, toIndex, emitEvent = true, source = "move-row" } = {}
  ) {
    if (isDisabled) return;
    const fromIndex = rows.findIndex((row) => row.id === rowId);
    if (fromIndex < 0) return;
    const targetIndex =
      typeof toIndex === "number" ? toIndex : fromIndex + Number(delta);
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= rows.length ||
      targetIndex === fromIndex
    ) {
      return;
    }
    const next = rows.slice();
    const [row] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, row);
    rows = next;
    render();
    if (emitEvent) {
      emit(source);
      announce(`Row moved to position ${targetIndex + 1}`);
    }
  }

  function addColumn(
    { label, type } = {},
    { emitEvent = true, source = "add-column", index } = {}
  ) {
    if (isDisabled) return null;
    const column = {
      id: nextId("col"),
      label:
        typeof label === "string" && label.trim()
          ? label.trim()
          : `Column ${columns.length + 1}`,
      type: parseColumnType(type),
    };
    const insertAt =
      typeof index === "number" && Number.isInteger(index)
        ? Math.max(0, Math.min(index, columns.length))
        : columns.length;
    columns.splice(insertAt, 0, column);
    for (const row of rows) {
      row.cells[column.id] = defaultValueForType(column.type);
    }
    render();
    focusColumnRename(column.id);
    if (emitEvent) {
      emit(source);
      announce(`Column ${column.label} added`);
    }
    return column.id;
  }

  function removeColumn(
    columnId,
    { emitEvent = true, source = "remove-column" } = {}
  ) {
    if (isDisabled) return;
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;
    columns = columns.filter((col) => col.id !== columnId);
    for (const row of rows) {
      delete row.cells[columnId];
    }
    render();
    if (emitEvent) {
      emit(source);
      announce(`Column ${column.label} deleted`);
    }
  }

  function renameColumn(
    columnId,
    label,
    { emitEvent = true, source = "rename" } = {}
  ) {
    if (isDisabled) return;
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;
    const next =
      typeof label === "string" && label.trim() ? label.trim() : column.label;
    if (next === column.label) return;
    column.label = next;
    render();
    if (emitEvent) emit(source);
  }

  function setColumnType(
    columnId,
    type,
    { emitEvent = true, source = "type-change" } = {}
  ) {
    if (isDisabled) return;
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;
    const nextType = parseColumnType(type);
    if (nextType === column.type) return;
    column.type = nextType;
    for (const row of rows) {
      row.cells[column.id] = coerceCellValue(row.cells[column.id], nextType);
    }
    render();
    if (emitEvent) emit(source);
  }

  function resetToBlank({
    emitEvent = true,
    source = "reset",
    columnCount = SIZE_PICKER_DEFAULT.cols,
    rowCount = SIZE_PICKER_DEFAULT.rows,
  } = {}) {
    if (isDisabled) return;
    const cols = Math.max(
      1,
      Math.floor(Number(columnCount)) || SIZE_PICKER_DEFAULT.cols
    );
    const rowTotal = Math.max(
      1,
      Math.floor(Number(rowCount)) || SIZE_PICKER_DEFAULT.rows
    );
    columns = Array.from({ length: cols }, (_, index) => ({
      id: nextId("col"),
      label: `Column ${index + 1}`,
      type: "text",
    }));
    rows = Array.from({ length: rowTotal }, () => ({
      id: nextId("row"),
      cells: Object.fromEntries(
        columns.map((col) => [col.id, defaultValueForType(col.type)])
      ),
    }));
    render();
    if (emitEvent) {
      emit(source);
      announce(`Table reset to ${cols} by ${rowTotal}`);
    }
  }

  function onAddRowClick() {
    addRow();
  }

  function onAddColClick() {
    addColumn();
  }

  function onResetClick(event) {
    event.stopPropagation();
    if (isDisabled) return;
    if (sizePopoverOpen) closeSizePopover();
    else openSizePopover();
  }

  /**
   * Resolve paste origin from the focused body cell, else (0, 0).
   * @returns {{ rowIndex: number, columnIndex: number }}
   */
  function resolvePasteOrigin(event) {
    const target =
      event.target instanceof Element
        ? event.target
        : document.activeElement instanceof Element
          ? document.activeElement
          : null;
    const cell = target?.closest?.("[data-tabular-input-cell]");
    if (!cell || !rootEl.contains(cell)) {
      return { rowIndex: 0, columnIndex: 0 };
    }
    const rowId = cell.dataset.rowId;
    const columnId = cell.dataset.columnId;
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    const columnIndex = columns.findIndex((col) => col.id === columnId);
    return {
      rowIndex: rowIndex >= 0 ? rowIndex : 0,
      columnIndex: columnIndex >= 0 ? columnIndex : 0,
    };
  }

  /**
   * Grow the grid and overwrite cells from an origin with a string matrix.
   * @param {string[][]} matrix
   * @param {{ rowIndex: number, columnIndex: number }} origin
   */
  function applyPasteMatrix(matrix, origin) {
    const pasteRows = matrix.length;
    const pasteCols = matrix[0]?.length ?? 0;
    if (!pasteRows || !pasteCols) return;

    const needCols = origin.columnIndex + pasteCols;
    const needRows = origin.rowIndex + pasteRows;

    while (columns.length < needCols) {
      const column = {
        id: nextId("col"),
        label: `Column ${columns.length + 1}`,
        type: /** @type {ColumnType} */ ("text"),
      };
      columns.push(column);
      for (const row of rows) {
        row.cells[column.id] = defaultValueForType("text");
      }
    }

    while (rows.length < needRows) {
      rows.push({
        id: nextId("row"),
        cells: Object.fromEntries(
          columns.map((col) => [col.id, defaultValueForType(col.type)])
        ),
      });
    }

    for (let r = 0; r < pasteRows; r += 1) {
      const row = rows[origin.rowIndex + r];
      for (let c = 0; c < pasteCols; c += 1) {
        const column = columns[origin.columnIndex + c];
        row.cells[column.id] = matrix[r][c] ?? "";
      }
    }

    for (const column of columns) {
      const values = rows.map((row) => row.cells[column.id]);
      const nextType = detectColumnType(values);
      column.type = nextType;
      for (const row of rows) {
        row.cells[column.id] = coerceCellValue(row.cells[column.id], nextType);
      }
    }
  }

  /**
   * Replace the entire grid from a clipboard matrix (exact size).
   * @param {string[][]} matrix
   * @param {{ firstRowIsHeader?: boolean }} [options]
   * @returns {boolean}
   */
  function replaceTableFromMatrix(matrix, { firstRowIsHeader = false } = {}) {
    const split = splitClipboardMatrix(matrix, { firstRowIsHeader });
    if (!split) return false;

    const { labels } = split;
    let { data } = split;
    if (!data.length) {
      data = [Array.from({ length: labels.length }, () => "")];
    }

    columns = labels.map((label) => ({
      id: nextId("col"),
      label,
      type: /** @type {ColumnType} */ ("text"),
    }));
    rows = data.map((cells) => ({
      id: nextId("row"),
      cells: Object.fromEntries(
        columns.map((col, index) => [col.id, cells[index] ?? ""])
      ),
    }));

    for (const column of columns) {
      const values = rows.map((row) => row.cells[column.id]);
      const nextType = detectColumnType(values);
      column.type = nextType;
      for (const row of rows) {
        row.cells[column.id] = coerceCellValue(row.cells[column.id], nextType);
      }
    }
    return true;
  }

  function onPaste(event) {
    if (isDisabled) return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!isTabularClipboardText(text)) return;
    event.preventDefault();
    const matrix = parseClipboardTable(text);
    const origin = resolvePasteOrigin(event);
    applyPasteMatrix(matrix, origin);
    render();
    emit("paste");
    announce("Pasted table data");
  }

  function isVisibleFocusable(el) {
    return el instanceof HTMLElement && el.offsetParent !== null && !el.closest(".hidden");
  }

  function getPrimaryFocusables() {
    return getFocusableElements(rootEl).filter(
      (el) => !el.closest("[data-tabular-input-chrome]")
    );
  }

  function getChromeFocusables() {
    const filterChrome = (selector) =>
      [...rootEl.querySelectorAll(selector)].filter(
        (el) =>
          el instanceof HTMLElement &&
          !el.disabled &&
          isVisibleFocusable(el)
      );
    // After data (incl. per-row delete): move-row controls only.
    return filterChrome('[data-tabular-input-chrome="move-row"]');
  }

  function getDocumentTabbables() {
    return [...document.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) =>
      isVisibleFocusable(el)
    );
  }

  function handleTabNavigation(event) {
    if (sizePopoverOpen) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !rootEl.contains(active)) return;

    const primary = getPrimaryFocusables();
    const chrome = getChromeFocusables();
    const inChrome = Boolean(active.closest("[data-tabular-input-chrome]"));

    if (!event.shiftKey) {
      if (
        !inChrome &&
        primary.length &&
        active === primary[primary.length - 1] &&
        chrome.length
      ) {
        event.preventDefault();
        chrome[0].focus();
        return;
      }
      if (inChrome) {
        const idx = chrome.indexOf(active);
        if (idx >= 0 && idx < chrome.length - 1) {
          event.preventDefault();
          chrome[idx + 1].focus();
          return;
        }
        if (idx === chrome.length - 1) {
          event.preventDefault();
          const doc = getDocumentTabbables();
          const lastPrimary = primary[primary.length - 1];
          const start = lastPrimary ? doc.indexOf(lastPrimary) : -1;
          const next = doc.find(
            (el, i) => i > start && !rootEl.contains(el)
          );
          next?.focus();
        }
      }
      return;
    }

    if (inChrome) {
      const idx = chrome.indexOf(active);
      if (idx > 0) {
        event.preventDefault();
        chrome[idx - 1].focus();
        return;
      }
      if (idx === 0 && primary.length) {
        event.preventDefault();
        primary[primary.length - 1].focus();
      }
    }
  }

  function getCellGrid() {
    return rows.map((row) =>
      columns.map((col) =>
        rootEl.querySelector(
          `[data-tabular-input-cell][data-row-id="${CSS.escape(row.id)}"][data-column-id="${CSS.escape(col.id)}"]`
        )
      )
    );
  }

  function handleArrowNavigation(event) {
    if (sizePopoverOpen) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !rootEl.contains(active)) return;

    const cell = active.matches("[data-tabular-input-cell]")
      ? active
      : active.closest("[data-tabular-input-cell]");
    if (!(cell instanceof HTMLElement)) return;

    // Left/right move the caret until it reaches an edge, then move cells.
    if (active instanceof HTMLInputElement && active.type === "text") {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        const len = active.value.length;
        if (event.key === "ArrowLeft" && (start !== 0 || end !== 0)) return;
        if (event.key === "ArrowRight" && (start !== len || end !== len)) {
          return;
        }
      }
    }

    const grid = getCellGrid();
    let rowIndex = -1;
    let colIndex = -1;
    for (let r = 0; r < grid.length; r += 1) {
      for (let c = 0; c < grid[r].length; c += 1) {
        if (grid[r][c] === cell) {
          rowIndex = r;
          colIndex = c;
        }
      }
    }
    if (rowIndex < 0) return;

    let nextRow = rowIndex;
    let nextCol = colIndex;
    if (event.key === "ArrowLeft") nextCol -= 1;
    else if (event.key === "ArrowRight") nextCol += 1;
    else if (event.key === "ArrowUp") nextRow -= 1;
    else if (event.key === "ArrowDown") nextRow += 1;
    else return;

    if (
      nextRow < 0 ||
      nextCol < 0 ||
      nextRow >= grid.length ||
      nextCol >= (grid[0]?.length ?? 0)
    ) {
      return;
    }

    const next = grid[nextRow][nextCol];
    if (!(next instanceof HTMLElement)) return;
    event.preventDefault();
    next.focus();
    if (
      next instanceof HTMLInputElement &&
      next.type !== "checkbox" &&
      typeof next.setSelectionRange === "function"
    ) {
      // Left → start (so further Left can leave); right/up/down → end.
      const pos = event.key === "ArrowLeft" ? 0 : next.value.length;
      try {
        next.setSelectionRange(pos, pos);
      } catch {
        /* some input types may not support setSelectionRange */
      }
    }
  }

  function onRootKeydown(event) {
    if (isDisabled) return;
    if (event.key === "Tab") {
      handleTabNavigation(event);
      return;
    }
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      handleArrowNavigation(event);
    }
  }

  function onBreakoutClick() {
    if (isDisabled || !isOverflowing) return;
    breakoutEnabled = !breakoutEnabled;
    closeTooltip();
    syncBreakoutLayout();
  }

  function resetCopyButtonLabel() {
    setButtonLabelFlash(copyBtn, "Copy");
    copyBtn.setAttribute("aria-label", "Copy table");
    copyBtn.dataset.tooltip = "Copy in tabular format";
    delete copyBtn.dataset.tooltipTone;
  }

  function resetPasteButtonLabel() {
    setButtonLabelFlash(pasteBtn, "Paste");
    pasteBtn.setAttribute("aria-label", "Paste table");
    pasteBtn.dataset.tooltip = "Replace table from clipboard";
    delete pasteBtn.dataset.tooltipTone;
  }

  function resetPasteHeadersButtonLabel() {
    setButtonLabelFlash(pasteHeadersBtn, "Paste with Headers");
    pasteHeadersBtn.setAttribute("aria-label", "Paste with headers");
    pasteHeadersBtn.dataset.tooltip =
      "Replace table from clipboard; first row becomes column headers";
    delete pasteHeadersBtn.dataset.tooltipTone;
  }

  async function onCopyClick() {
    if (isDisabled) return;
    closeTooltip();
    const text = formatClipboardTable(columns, rows);
    const ok = await copyText(text);
    flashButtonLabel(copyBtn, ok, { reset: resetCopyButtonLabel });
    if (ok) announce("Table copied");
  }

  /**
   * @param {{ firstRowIsHeader: boolean, button: HTMLButtonElement, reset: () => void, announceOk: string }} opts
   */
  async function onPasteReplaceClick(opts) {
    if (isDisabled) return;

    // Second click while armed cancels.
    if (pasteCaptureSession?.button === opts.button) {
      endPasteCapture();
      announce("Paste cancelled");
      return;
    }

    // Start read while the click's user activation is still fresh.
    const readPromise = readText();
    closeTooltip();

    let text = await readPromise;
    if (text === null) {
      text = await waitForPasteViaShortcut(opts.button, opts.reset);
      if (text === null) return;
    }

    const matrix = parseClipboardTable(text);
    const ok = replaceTableFromMatrix(matrix, {
      firstRowIsHeader: opts.firstRowIsHeader,
    });
    if (ok) {
      render();
      emit("paste");
      announce(opts.announceOk);
    }
    flashButtonLabel(opts.button, ok, {
      success: "Pasted",
      reset: opts.reset,
    });
  }

  /**
   * End an armed paste-capture session (cancels the shared capture).
   */
  function endPasteCapture() {
    const session = pasteCaptureSession;
    if (!session) return;
    pasteCaptureSession = null;
    session.capture.cancel();
    session.reset();
  }

  /**
   * When Clipboard API read is blocked, arm a one-shot document paste listener
   * and prompt for Ctrl+V (same data path as in-grid paste).
   * @param {HTMLButtonElement} button
   * @param {() => void} reset
   * @returns {Promise<string | null>}
   */
  function waitForPasteViaShortcut(button, reset) {
    endPasteCapture();

    setButtonLabelFlash(button, "Ctrl+V");
    button.setAttribute("aria-label", "Press Control V to paste");
    button.dataset.tooltip = "Press Ctrl+V to paste";
    button.dataset.tooltipTone = "error";
    announce("Press Control V to paste");

    const capture = armPasteCapture({ timeoutMs: 15000 });
    pasteCaptureSession = { button, reset, capture };

    return capture.promise.then((text) => {
      if (pasteCaptureSession?.capture === capture) {
        pasteCaptureSession = null;
        reset();
      }
      return text;
    });
  }

  function onPasteClick() {
    return onPasteReplaceClick({
      firstRowIsHeader: false,
      button: pasteBtn,
      reset: resetPasteButtonLabel,
      announceOk: "Table replaced from clipboard",
    });
  }

  function onPasteHeadersClick() {
    return onPasteReplaceClick({
      firstRowIsHeader: true,
      button: pasteHeadersBtn,
      reset: resetPasteHeadersButtonLabel,
      announceOk: "Table replaced from clipboard with headers",
    });
  }

  function onBreakoutViewportChange() {
    scheduleBreakoutSync();
  }

  /** Slot width only — avoid observing the grid itself (breakout would loop). */
  const breakoutResizeObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          scheduleBreakoutSync();
        })
      : null;
  if (rootEl.parentElement) {
    breakoutResizeObserver?.observe(rootEl.parentElement);
  }

  addRowBtn.addEventListener("click", onAddRowClick);
  addColBtn.addEventListener("click", onAddColClick);
  resetBtn.addEventListener("click", onResetClick);
  breakoutBtn.addEventListener("click", onBreakoutClick);
  copyBtn.addEventListener("click", onCopyClick);
  pasteBtn.addEventListener("click", onPasteClick);
  pasteHeadersBtn.addEventListener("click", onPasteHeadersClick);
  rootEl.addEventListener("paste", onPaste);
  rootEl.addEventListener("keydown", onRootKeydown);
  window.addEventListener("resize", onBreakoutViewportChange);

  render();

  return {
    getData() {
      return snapshot();
    },
    setData(data, { emitEvent = true } = {}) {
      const nextColumns = normalizeColumns(data?.columns, nextId);
      const nextRows = normalizeRows(data?.rows, nextColumns, nextId);
      columns = nextColumns;
      rows = nextRows;
      render();
      if (emitEvent) emit("api");
    },
    addRow(options) {
      return addRow({ ...options, source: options?.source ?? "api" });
    },
    removeRow(rowId, options) {
      removeRow(rowId, { ...options, source: options?.source ?? "api" });
    },
    moveRow(rowId, options) {
      moveRow(rowId, { ...options, source: options?.source ?? "api" });
    },
    addColumn(column, options) {
      return addColumn(column, {
        ...options,
        source: options?.source ?? "api",
      });
    },
    removeColumn(columnId, options) {
      removeColumn(columnId, {
        ...options,
        source: options?.source ?? "api",
      });
    },
    renameColumn(columnId, label, options) {
      renameColumn(columnId, label, {
        ...options,
        source: options?.source ?? "api",
      });
    },
    setColumnType(columnId, type, options) {
      setColumnType(columnId, type, {
        ...options,
        source: options?.source ?? "api",
      });
    },
    reset(options) {
      resetToBlank({
        columnCount: options?.columnCount,
        rowCount: options?.rowCount,
        emitEvent: options?.emitEvent,
        source: options?.source ?? "api",
      });
    },
    setDisabled(next) {
      isDisabled = Boolean(next);
      render();
    },
    setBreakoutEnabled(next) {
      breakoutEnabled = Boolean(next);
      syncBreakoutLayout();
    },
    getBreakoutEnabled() {
      return breakoutEnabled;
    },
    destroy() {
      for (const menu of typeMenus) menu.destroy();
      typeMenus = [];
      if (breakoutSyncFrame !== null) {
        cancelAnimationFrame(breakoutSyncFrame);
        breakoutSyncFrame = null;
      }
      cancelButtonLabelFlash(copyBtn);
      cancelButtonLabelFlash(pasteBtn);
      cancelButtonLabelFlash(pasteHeadersBtn);
      endPasteCapture();
      breakoutResizeObserver?.disconnect();
      addRowBtn.removeEventListener("click", onAddRowClick);
      addColBtn.removeEventListener("click", onAddColClick);
      resetBtn.removeEventListener("click", onResetClick);
      breakoutBtn.removeEventListener("click", onBreakoutClick);
      copyBtn.removeEventListener("click", onCopyClick);
      pasteBtn.removeEventListener("click", onPasteClick);
      pasteHeadersBtn.removeEventListener("click", onPasteHeadersClick);
      rootEl.removeEventListener("paste", onPaste);
      rootEl.removeEventListener("keydown", onRootKeydown);
      window.removeEventListener("resize", onBreakoutViewportChange);
      window.removeEventListener("scroll", onSizePopoverViewportChange, true);
      window.removeEventListener("resize", onSizePopoverViewportChange);
      removeSizePopoverOutside();
      removeSizePopoverEscape();
      closeSizePopover();
      clearBreakoutStyles();
      rootEl.replaceChildren();
      rootEl.classList.remove(
        "tabular-input",
        "tabular-input--disabled",
        "tabular-input--breakout"
      );
    },
  };
}

/** Wire every `.tabular-input` in `root`. */
export function initTabularInputs(root = document) {
  const instances = [];
  root.querySelectorAll(".tabular-input").forEach((el) => {
    const instance = initTabularInput(el);
    if (instance) instances.push(instance);
  });
  return instances;
}
