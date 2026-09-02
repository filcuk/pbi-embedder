/**
 * Render converter table data into a framework read-only `.table-block`.
 */

import { formatCellForClipboard } from "../components/tabular-input.js";
import { initTable } from "../components/table.js";

/**
 * @typedef {{ id: string, label: string, type: "text" | "number" | "logical" }} Column
 * @typedef {{ id: string, cells: Record<string, string | number | boolean | null> }} Row
 * @typedef {{ columns: Column[], rows: Row[] }} TableData
 */

/**
 * @param {Column["type"] | string} type
 * @returns {"text" | "number" | "date"}
 */
function sortTypeForColumn(type) {
  return type === "number" ? "number" : "text";
}

/**
 * Replace thead/tbody contents and (re)wire `initTable`.
 *
 * @param {HTMLElement | null} blockEl `.table-block` host
 * @param {TableData | null | undefined} table
 * @param {{ destroy?: () => void } | null} [previous]
 * @returns {{ destroy: () => void } | null}
 */
export function renderOutputTable(blockEl, table, previous = null) {
  previous?.destroy?.();
  if (!blockEl) return null;

  const tableEl = blockEl.querySelector("table.table");
  const theadRow = tableEl?.querySelector("thead tr");
  const tbody = tableEl?.querySelector("tbody");
  if (!tableEl || !theadRow || !tbody) return null;

  const columns = table?.columns ?? [];
  const rows = table?.rows ?? [];

  theadRow.replaceChildren();
  tbody.replaceChildren();

  for (const column of columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.dataset.tableSort = "";
    th.dataset.sortType = sortTypeForColumn(column.type);
    if (column.type === "number") {
      th.classList.add("table-num");
    }
    th.textContent = column.label || column.id;
    theadRow.append(th);
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.id) {
      tr.dataset.tableRowId = row.id;
    }
    for (const column of columns) {
      const td = document.createElement("td");
      if (column.type === "number") {
        td.classList.add("table-num");
      }
      td.textContent = formatCellForClipboard(
        row.cells?.[column.id],
        column.type
      );
      tr.append(td);
    }
    tbody.append(tr);
  }

  return initTable(blockEl, { sortable: true });
}
