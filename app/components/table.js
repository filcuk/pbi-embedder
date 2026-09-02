/**
 * Data table — styled table with optional sortable columns and row selection.
 *
 * Markup:
 *   <div class="table-block" data-table-sortable data-table-selectable>
 *     <div class="table-wrap">
 *       <table class="table table--striped">
 *         <caption class="table-caption">Team members</caption>
 *         <thead>
 *           <tr>
 *             <th class="table-select-col" scope="col">
 *               <label class="checkbox">
 *                 <input type="checkbox" class="checkbox-input" data-table-select-all
 *                   aria-label="Select all rows" />
 *               </label>
 *             </th>
 *             <th scope="col" data-table-sort data-sort-type="text">
 *               <button type="button" class="table-sort-button">Name</button>
 *             </th>
 *           </tr>
 *         </thead>
 *         <tbody>
 *           <tr data-table-row-id="1">
 *             <td class="table-select-col">…</td>
 *             <td>…</td>
 *           </tr>
 *         </tbody>
 *       </table>
 *     </div>
 *   </div>
 *
 * data-table-sortable — enable column sorting (requires data-table-sort on th)
 * data-table-selectable — enable row checkboxes and select-all
 * data-table-disabled — disable interaction
 * data-sort-type on th — text | number | date (default text)
 * data-table-sort-default on th — ascending | descending (initial sort; multiple
 *   headers stack in document order — primary first)
 *
 * Sort: header click cycles ascending → descending → unsorted. Hold Shift while
 * clicking to add or cycle a secondary column without clearing the others.
 */

import { createIcon } from "../utils/icons.js";
import { parseBooleanAttr, setHidden } from "../utils/dom.js";

const SORT_TYPES = ["text", "number", "date"];
const SORT_DIRECTIONS = ["ascending", "descending"];

function parseSortType(value) {
  return SORT_TYPES.includes(value) ? value : "text";
}

function parseSortDirection(value) {
  return SORT_DIRECTIONS.includes(value) ? value : null;
}

function resolveSortable(blockEl, sortableOption) {
  if (typeof sortableOption === "boolean") return sortableOption;
  return parseBooleanAttr(blockEl?.dataset.tableSortable) ?? false;
}

function resolveSelectable(blockEl, selectableOption) {
  if (typeof selectableOption === "boolean") return selectableOption;
  return parseBooleanAttr(blockEl?.dataset.tableSelectable) ?? false;
}

function resolveDisabled(blockEl, disabledOption) {
  if (typeof disabledOption === "boolean") return disabledOption;
  return parseBooleanAttr(blockEl?.dataset.tableDisabled) ?? false;
}

export function getCellValue(cell, sortType) {
  const raw = cell?.textContent?.trim() ?? "";
  if (sortType === "number") {
    const value = Number.parseFloat(raw.replace(/[^\d.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  }
  if (sortType === "date") {
    const value = Date.parse(raw);
    return Number.isFinite(value) ? value : 0;
  }
  return raw.toLocaleLowerCase();
}

export function compareValues(a, b, sortType) {
  if (sortType === "number" || sortType === "date") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

/**
 * Compare two rows by an ordered list of sort columns (first wins, then next).
 * @param {HTMLTableRowElement} rowA
 * @param {HTMLTableRowElement} rowB
 * @param {{ columnIndex: number, sortType: string, direction: "ascending" | "descending" }[]} columns
 * @returns {number}
 */
export function compareRowsByColumns(rowA, rowB, columns) {
  for (const { columnIndex, sortType, direction } of columns) {
    const multiplier = direction === "descending" ? -1 : 1;
    const cmp =
      compareValues(
        getCellValue(rowA.cells[columnIndex], sortType),
        getCellValue(rowB.cells[columnIndex], sortType),
        sortType
      ) * multiplier;
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function nextSortDirection(current) {
  if (current === "ascending") return "descending";
  if (current === "descending") return null;
  return "ascending";
}

function ensureSortIcon(button) {
  let icon = button.querySelector(".table-sort-icon");
  if (icon) return icon;

  icon = document.createElement("span");
  icon.className = "table-sort-icon hidden";
  icon.setAttribute("aria-hidden", "true");
  icon.append(createIcon("chevron-up", { className: "table-sort-icon-svg" }));
  button.append(icon);
  return icon;
}

function setSortButtonState(button, direction) {
  if (!direction) {
    button.removeAttribute("aria-sort");
    const icon = button.querySelector(".table-sort-icon");
    if (icon) setHidden(icon, true);
    return;
  }

  button.setAttribute("aria-sort", direction);
  const icon = ensureSortIcon(button);
  setHidden(icon, false);
  const iconName = direction === "ascending" ? "chevron-up" : "chevron-down";
  icon.replaceChildren(createIcon(iconName, { className: "table-sort-icon-svg" }));
}

/**
 * @param {HTMLTableCellElement[]} sortHeaders
 * @param {unknown} defaultSortOption
 * @returns {{ th: HTMLTableCellElement, direction: "ascending" | "descending" }[]}
 */
function resolveDefaultSort(sortHeaders, defaultSortOption) {
  if (Array.isArray(defaultSortOption)) {
    const entries = [];
    for (const item of defaultSortOption) {
      if (!item || typeof item !== "object") continue;
      const direction = parseSortDirection(item.direction);
      if (direction === null || typeof item.columnIndex !== "number") continue;
      const th = sortHeaders.find((header) => header.cellIndex === item.columnIndex);
      if (th) entries.push({ th, direction });
    }
    return entries;
  }

  if (defaultSortOption && typeof defaultSortOption === "object") {
    const direction = parseSortDirection(defaultSortOption.direction);
    if (direction !== null && typeof defaultSortOption.columnIndex === "number") {
      const th = sortHeaders.find(
        (header) => header.cellIndex === defaultSortOption.columnIndex
      );
      if (th) return [{ th, direction }];
    }
  }

  const fromMarkup = [];
  for (const th of sortHeaders) {
    const direction = parseSortDirection(th.dataset.tableSortDefault);
    if (direction) fromMarkup.push({ th, direction });
  }
  return fromMarkup;
}

export function initTable(
  blockEl,
  { sortable, selectable, disabled, defaultSort, onSort, onSelectionChange } = {}
) {
  if (!blockEl) return null;

  const tableEl = blockEl.querySelector("table.table");
  const tbody = tableEl?.querySelector("tbody");
  if (!tableEl || !tbody) return null;

  const isSortable = resolveSortable(blockEl, sortable);
  const isSelectable = resolveSelectable(blockEl, selectable);
  let isDisabled = resolveDisabled(blockEl, disabled);

  const sortHeaders = isSortable
    ? [...tableEl.querySelectorAll("th[data-table-sort]")]
    : [];
  const sortButtons = sortHeaders.map((th) => {
    let button = th.querySelector(".table-sort-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "table-sort-button";
      button.textContent = th.textContent?.trim() ?? "";
      th.textContent = "";
      th.append(button);
    }
    return button;
  });

  const selectAllInput = blockEl.querySelector("[data-table-select-all]");
  const rowInputs = () => [
    ...tbody.querySelectorAll("[data-table-row-select]"),
  ];
  const originalRowOrder = isSortable ? [...tbody.querySelectorAll("tr")] : [];

  /** @type {{ th: HTMLTableCellElement, button: HTMLButtonElement, columnIndex: number, sortType: string, direction: "ascending" | "descending" }[]} */
  let sortStack = [];

  function syncDisabledClass() {
    blockEl.classList.toggle("table-block--disabled", isDisabled);
  }

  function getSelectedRows() {
    return rowInputs()
      .filter((input) => input.checked)
      .map((input) => input.closest("tr"))
      .filter(Boolean);
  }

  function getSelectedIds() {
    return getSelectedRows()
      .map((row) => row.dataset.tableRowId)
      .filter((id) => id !== undefined);
  }

  function emitSelection(source) {
    onSelectionChange?.({
      selectedRows: getSelectedRows(),
      selectedIds: getSelectedIds(),
      source,
    });
  }

  function syncSelectAllState() {
    if (!selectAllInput) return;
    const inputs = rowInputs();
    const checkedCount = inputs.filter((input) => input.checked).length;
    selectAllInput.indeterminate =
      checkedCount > 0 && checkedCount < inputs.length;
    selectAllInput.checked = inputs.length > 0 && checkedCount === inputs.length;
  }

  function applySortStack() {
    if (sortStack.length === 0) {
      restoreOriginalOrder();
      return;
    }

    const rows = [...tbody.querySelectorAll("tr")];
    const columns = sortStack.map(({ columnIndex, sortType, direction }) => ({
      columnIndex,
      sortType,
      direction,
    }));

    rows.sort((rowA, rowB) => {
      const cmp = compareRowsByColumns(rowA, rowB, columns);
      if (cmp !== 0) return cmp;
      return originalRowOrder.indexOf(rowA) - originalRowOrder.indexOf(rowB);
    });

    for (const row of rows) {
      tbody.append(row);
    }
  }

  function restoreOriginalOrder() {
    const known = new Set(originalRowOrder);
    for (const row of originalRowOrder) {
      if (row.parentNode === tbody) tbody.append(row);
    }
    for (const row of [...tbody.querySelectorAll("tr")]) {
      if (!known.has(row)) tbody.append(row);
    }
  }

  function syncSortButtonStates() {
    for (const button of sortButtons) {
      setSortButtonState(button, null);
    }
    for (const { button, direction } of sortStack) {
      setSortButtonState(button, direction);
    }
  }

  function emitSort(columnIndex, direction, sortType, source) {
    onSort?.({
      columnIndex,
      direction,
      sortType,
      columns: sortStack.map(({ columnIndex: i, direction: d, sortType: t }) => ({
        columnIndex: i,
        direction: d,
        sortType: t,
      })),
      source,
    });
  }

  function onSortHeaderClick(th, button, event) {
    if (isDisabled) return;

    const multi = Boolean(event?.shiftKey);
    const columnIndex = th.cellIndex;
    const sortType = parseSortType(th.dataset.sortType);
    const existingIndex = sortStack.findIndex((entry) => entry.columnIndex === columnIndex);
    const current = existingIndex >= 0 ? sortStack[existingIndex].direction : null;
    const next = nextSortDirection(current);

    if (!multi) {
      sortStack = next
        ? [{ th, button, columnIndex, sortType, direction: next }]
        : [];
    } else if (existingIndex >= 0) {
      if (next) {
        sortStack[existingIndex] = {
          th,
          button,
          columnIndex,
          sortType,
          direction: next,
        };
      } else {
        sortStack.splice(existingIndex, 1);
      }
    } else if (next) {
      sortStack.push({ th, button, columnIndex, sortType, direction: next });
    }

    syncSortButtonStates();
    applySortStack();
    emitSort(columnIndex, next, sortType, "header");
  }

  const sortHandlers = sortHeaders.map((th, index) => {
    const button = sortButtons[index];
    const onClick = (event) => onSortHeaderClick(th, button, event);
    const onMouseDown = (event) => {
      if (event.shiftKey) event.preventDefault();
    };
    button.addEventListener("click", onClick);
    button.addEventListener("mousedown", onMouseDown);
    return { button, onClick, onMouseDown };
  });

  function onSelectAllChange() {
    if (isDisabled || !selectAllInput) return;
    const checked = selectAllInput.checked;
    for (const input of rowInputs()) {
      input.checked = checked;
    }
    selectAllInput.indeterminate = false;
    emitSelection("selectAll");
  }

  function onRowSelectChange() {
    if (isDisabled) return;
    syncSelectAllState();
    emitSelection("row");
  }

  /** Toggle row checkbox when clicking the row (not nested controls). */
  function onBodyClick(e) {
    if (isDisabled || !isSelectable) return;

    const row = e.target.closest("tr");
    if (!row || !tbody.contains(row)) return;
    if (e.target.closest("a, button, input, label, select, textarea")) return;

    const input = row.querySelector("[data-table-row-select]");
    if (!input || input.disabled) return;

    input.checked = !input.checked;
    syncSelectAllState();
    emitSelection("row");
  }

  selectAllInput?.addEventListener("change", onSelectAllChange);

  const rowHandlers = [];

  blockEl.classList.toggle("table-block--selectable", isSelectable);

  if (isSelectable) {
    for (const input of rowInputs()) {
      const handler = onRowSelectChange;
      input.addEventListener("change", handler);
      rowHandlers.push({ input, handler });
    }
    tbody.addEventListener("click", onBodyClick);
  } else {
    const selectCells = [
      selectAllInput?.closest("th, td"),
      ...rowInputs().map((input) => input.closest("td, th")),
    ].filter(Boolean);

    for (const cell of selectCells) {
      setHidden(cell, true);
    }
  }

  syncDisabledClass();
  syncSelectAllState();

  const initialSort = isSortable
    ? resolveDefaultSort(sortHeaders, defaultSort)
    : [];
  if (initialSort.length) {
    sortStack = initialSort.map(({ th, direction }) => {
      const button = th.querySelector(".table-sort-button");
      return {
        th,
        button,
        columnIndex: th.cellIndex,
        sortType: parseSortType(th.dataset.sortType),
        direction,
      };
    });
    syncSortButtonStates();
    applySortStack();
    const primary = sortStack[0];
    emitSort(primary.columnIndex, primary.direction, primary.sortType, "default");
  }

  return {
    getSelectedRows() {
      return getSelectedRows();
    },
    getSelectedIds() {
      return getSelectedIds();
    },
    getSortColumns() {
      return sortStack.map(({ columnIndex, direction, sortType }) => ({
        columnIndex,
        direction,
        sortType,
      }));
    },
    clearSelection() {
      if (selectAllInput) {
        selectAllInput.checked = false;
        selectAllInput.indeterminate = false;
      }
      for (const input of rowInputs()) {
        input.checked = false;
      }
      emitSelection("clear");
    },
    setDisabled(next) {
      isDisabled = Boolean(next);
      syncDisabledClass();
    },
    destroy() {
      for (const { button, onClick, onMouseDown } of sortHandlers) {
        button.removeEventListener("click", onClick);
        button.removeEventListener("mousedown", onMouseDown);
      }
      selectAllInput?.removeEventListener("change", onSelectAllChange);
      for (const { input, handler } of rowHandlers) {
        input.removeEventListener("change", handler);
      }
      if (isSelectable) {
        tbody.removeEventListener("click", onBodyClick);
      }
      blockEl.classList.remove("table-block--selectable");
    },
  };
}

/** Wire every `.table-block` with a `table.table` in `root`. */
export function initTables(root = document) {
  const instances = [];

  for (const el of root.querySelectorAll(".table-block")) {
    const instance = initTable(el);
    if (instance) instances.push(instance);
  }

  return instances;
}
