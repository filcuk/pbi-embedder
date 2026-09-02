import { initBadge } from "./badge.js";
import { parseBooleanAttr, setHidden } from "../utils/dom.js";
import {
  getListGridColumns,
  gridMenuIndexForKey,
  resolveListGridConfig,
  syncListGridSelectionJoins,
  syncPopupListGrid,
} from "../utils/menu.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../utils/document-listeners.js";

/**
 * Text input with a filterable suggestion list.
 *
 * Markup:
 *   <div class="combobox" id="my-combobox">
 *     <label class="field-label" for="my-combobox-input">Label</label>
 *     <div class="combobox-control">
 *       <input type="text" id="my-combobox-input" class="input combobox-input"
 *         role="combobox" aria-expanded="false" aria-autocomplete="list"
 *         aria-controls="my-combobox-list" autocomplete="off" />
 *       <ul id="my-combobox-list" class="combobox-list hidden" role="listbox" hidden>
 *         <li role="presentation">
 *           <button type="button" class="combobox-option" role="option" data-value="alpha">Alpha</button>
 *         </li>
 *       </ul>
 *     </div>
 *   </div>
 *
 * Multi-select (`data-combobox-multi` / `multi: true`):
 *   Same control as single-select; selected labels show as a comma-separated list in the
 *   input. Typing replaces that summary with a filter query (kept separate from the
 *   selection); the summary is restored when the list closes (including when the filter
 *   is emptied — clear selection with setValues([]) / setValue("")). Selection count
 *   uses a badge (wrap `.combobox-control` in `.badge-host` with a `.badge`, or let this
 *   init create that markup). Options toggle; list stays open while picking (close via
 *   Escape, blur, or outside click). Initial selection: `aria-selected="true"` on options,
 *   comma-separated `.combobox-value`, or `defaultValues` / `defaultValue` in JS. Option and
 *   custom values must not contain commas (the `.combobox-value` delimiter).
 *
 * data-combobox-allow-custom — accept free text on blur/commit (default: list values only)
 * data-combobox-multi — multi-select mode
 * data-combobox-grid / data-combobox-grid-min / data-combobox-grid-cols — auto grid list (same as dropdown)
 */

function readOptionsFromMarkup(listEl) {
  if (!listEl) return [];

  return [...listEl.querySelectorAll(".combobox-option")].map((optionEl) => ({
    value: optionEl.dataset.value ?? optionEl.textContent.trim(),
    label: optionEl.textContent.trim(),
    element: optionEl,
    itemEl: optionEl.closest("li"),
    selected: optionEl.getAttribute("aria-selected") === "true",
  }));
}

function buildOptionElement({ value, label }, listId, index) {
  const item = document.createElement("li");
  item.setAttribute("role", "presentation");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "combobox-option";
  button.setAttribute("role", "option");
  button.dataset.value = value;
  button.id = `${listId}-option-${index}`;
  button.textContent = label;

  item.append(button);
  return { value, label, element: button, itemEl: item, selected: false };
}

function defaultFilter(query, option) {
  if (!query) return true;
  const haystack = `${option.label} ${option.value}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function findOptionByLabel(options, text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return (
    options.find((option) => option.label.toLowerCase() === lower) ||
    options.find((option) => String(option.value).toLowerCase() === lower) ||
    null
  );
}

export function parseValueList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
  if (raw === null || raw === undefined || raw === "") return [];
  return String(raw)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Multi-select values must not contain `,` — that character is the delimiter for
 * `.combobox-value` / `getValue()` / `setValue()`.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeMultiValue(value) {
  return !String(value ?? "").includes(",");
}

/**
 * Prefer an existing `.badge-host` around the control; otherwise wrap it and add a badge.
 */
function ensureSelectionBadgeHost(comboboxEl, control, input) {
  if (!control) return null;

  let host = control.closest(".badge-host");
  if (!host || !comboboxEl.contains(host)) {
    host = document.createElement("span");
    host.className = "badge-host";
    control.parentNode?.insertBefore(host, control);
    host.appendChild(control);
  }

  if (!host.dataset.badgeLabel) {
    const fromRoot = comboboxEl.dataset.badgeLabel?.trim();
    const fromLabel = comboboxEl.querySelector(`label[for="${input.id}"]`);
    const labelText = fromRoot || fromLabel?.textContent?.trim();
    if (labelText) host.dataset.badgeLabel = labelText;
  }

  if (!input.hasAttribute("data-badge-control")) {
    input.setAttribute("data-badge-control", "");
  }

  let badgeEl = host.querySelector(".badge");
  if (!badgeEl) {
    badgeEl = document.createElement("span");
    badgeEl.className = "badge";
    badgeEl.setAttribute("aria-hidden", "true");
    setHidden(badgeEl, true);
    host.appendChild(badgeEl);
  }

  return host;
}

export function initCombobox(
  comboboxEl,
  {
    options,
    filter,
    allowCustom,
    multi,
    defaultValue,
    defaultValues,
    onSelect,
    onToggle,
    onChange,
    onInput,
    gridMin,
    gridCols,
  } = {}
) {
  if (!comboboxEl) return null;

  const input = comboboxEl.querySelector(".combobox-input");
  const list = comboboxEl.querySelector(".combobox-list");
  const valueInput = comboboxEl.querySelector(".combobox-value");
  const control = comboboxEl.querySelector(".combobox-control");

  if (!input || !list) return null;

  const gridOverrides = {};
  if (gridMin !== undefined) gridOverrides.gridMin = gridMin;
  if (gridCols !== undefined) gridOverrides.gridCols = gridCols;

  function getGridConfig() {
    return resolveListGridConfig(comboboxEl, gridOverrides);
  }

  function syncListGrid() {
    return syncPopupListGrid(list, comboboxEl, ".combobox-option", getGridConfig());
  }

  function isGridListOpen() {
    return list.classList.contains("combobox-list--grid");
  }

  const listId = list.id || `combobox-list-${Math.random().toString(36).slice(2, 9)}`;
  if (!list.id) list.id = listId;
  input.setAttribute("aria-controls", listId);

  const isMulti =
    multi ??
    parseBooleanAttr(comboboxEl.dataset.comboboxMulti) ??
    comboboxEl.hasAttribute("data-combobox-multi");

  const allowFreeText =
    allowCustom ??
    (comboboxEl.hasAttribute("data-combobox-allow-custom") ||
      comboboxEl.dataset.comboboxAllowCustom === "true");

  const matchOption =
    typeof filter === "function"
      ? (query, option) => filter(query, option)
      : defaultFilter;

  let optionRecords = [];
  let emptyEl = list.querySelector(".combobox-empty");
  let isOpen = false;
  let activeIndex = -1;

  /** @type {string} */
  let selectedValue = "";
  /** @type {string} */
  let selectedLabel = "";
  /** @type {Map<string, string>} value → label */
  const selectedMap = new Map();
  /** Multi-select filter text; kept separate from the comma summary in the input. */
  let filterQuery = "";

  /** @type {ReturnType<typeof initBadge> | null} */
  let selectionBadge = null;

  if (isMulti) {
    comboboxEl.classList.add("combobox--multi");
    list.setAttribute("aria-multiselectable", "true");
    comboboxEl.querySelector(".combobox-chips")?.remove();
    const badgeHost = ensureSelectionBadgeHost(comboboxEl, control, input);
    selectionBadge = initBadge(badgeHost, { value: 0 });
  }

  function applyOptions(nextOptions) {
    list.replaceChildren();
    emptyEl = null;
    optionRecords = nextOptions.map((option, index) => {
      const record = buildOptionElement(option, listId, index);
      list.append(record.itemEl);
      return record;
    });
  }

  if (Array.isArray(options) && options.length) {
    applyOptions(options);
  } else {
    optionRecords = readOptionsFromMarkup(list).map((record, index) => {
      if (!record.element.id) {
        record.element.id = `${listId}-option-${index}`;
      }
      return record;
    });
  }

  function syncSelectedLabel() {
    const match = optionRecords.find((option) => option.value === selectedValue);
    selectedLabel = match?.label ?? (allowFreeText ? selectedValue : "");
  }

  function selectedEntries() {
    return [...selectedMap.entries()].map(([value, label]) => ({ value, label }));
  }

  function selectedValues() {
    return [...selectedMap.keys()];
  }

  function selectedLabels() {
    return [...selectedMap.values()];
  }

  function multiSummary() {
    return selectedLabels().join(", ");
  }

  function setValueInputFromState() {
    if (!valueInput) return;
    valueInput.value = isMulti ? selectedValues().join(",") : selectedValue;
  }

  function updateSelectionBadge() {
    if (!isMulti) return;
    selectionBadge?.setValue(selectedMap.size);
  }

  function syncMultiInputDisplay() {
    if (!isMulti) return;
    filterQuery = "";
    input.value = multiSummary();
  }

  function emitChange(extra = {}) {
    if (isMulti) {
      onChange?.({
        comboboxEl,
        values: selectedValues(),
        labels: selectedLabels(),
        selected: selectedEntries(),
        input: input.value,
        ...extra,
      });
      return;
    }

    onChange?.({
      comboboxEl,
      value: selectedValue,
      label: selectedLabel || input.value.trim(),
      input: input.value,
      ...extra,
    });
  }

  function setValueInput(value) {
    if (valueInput) valueInput.value = value;
  }

  function getFilterQuery() {
    if (!isMulti) return input.value.trim();
    return filterQuery.trim();
  }

  function getVisibleOptions() {
    const query = getFilterQuery();
    return optionRecords.filter((option) => matchOption(query, option));
  }

  function clearActiveOption() {
    for (const option of optionRecords) {
      option.element.classList.remove("is-active");
      if (!isMulti) {
        option.element.removeAttribute("aria-selected");
      }
    }
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
  }

  function setActiveOption(index, { scroll = true } = {}) {
    const visible = getVisibleOptions();
    clearActiveOption();
    if (!visible.length) return;

    const clamped = Math.max(0, Math.min(index, visible.length - 1));
    const option = visible[clamped];
    activeIndex = optionRecords.indexOf(option);
    option.element.classList.add("is-active");
    if (!isMulti) {
      option.element.setAttribute("aria-selected", "true");
    }
    input.setAttribute("aria-activedescendant", option.element.id);
    if (scroll) option.element.scrollIntoView({ block: "nearest" });
  }

  function ensureEmptyState(visibleCount) {
    if (visibleCount > 0) {
      if (emptyEl) setHidden(emptyEl, true);
      return;
    }

    if (!emptyEl) {
      emptyEl = document.createElement("li");
      emptyEl.className = "combobox-empty";
      emptyEl.setAttribute("role", "presentation");
      emptyEl.textContent = "No matches";
      list.append(emptyEl);
    } else if (!emptyEl.parentElement) {
      list.append(emptyEl);
    }

    setHidden(emptyEl, false);
  }

  function syncOptionSelectedState() {
    for (const option of optionRecords) {
      const selected = isMulti
        ? selectedMap.has(option.value)
        : option.value === selectedValue;
      option.element.classList.toggle("is-selected", selected);
      option.element.setAttribute("aria-selected", selected ? "true" : "false");
    }
  }

  function renderList() {
    const query = getFilterQuery();
    const visible = getVisibleOptions();
    const visibleSet = new Set(visible);

    for (const option of optionRecords) {
      const show = visibleSet.has(option);
      setHidden(option.itemEl ?? option.element.closest("li"), !show);
    }

    syncOptionSelectedState();
    ensureEmptyState(visible.length);

    if (isOpen && visible.length) {
      const current = activeIndex >= 0 ? optionRecords[activeIndex] : null;
      if (current && visibleSet.has(current)) {
        setActiveOption(visible.indexOf(current));
      } else {
        setActiveOption(0);
      }
    } else {
      clearActiveOption();
      if (isMulti) syncOptionSelectedState();
    }

    onInput?.({ comboboxEl, query, matches: visible.map(({ value, label }) => ({ value, label })) });
    syncListGrid();
  }

  function openList() {
    if (isOpen) {
      renderList();
      return;
    }

    registerOpenPopup(closeList);
    isOpen = true;
    comboboxEl.classList.add("is-popup-open");
    setHidden(list, false);
    input.setAttribute("aria-expanded", "true");
    renderList();
  }

  function closeList({ restoreInput = false } = {}) {
    unregisterOpenPopup(closeList);
    if (!isOpen && !restoreInput) return;

    isOpen = false;
    comboboxEl.classList.remove("is-popup-open");
    setHidden(list, true);
    input.setAttribute("aria-expanded", "false");
    clearActiveOption();
    if (isMulti) syncOptionSelectedState();

    if (restoreInput) {
      if (isMulti) syncMultiInputDisplay();
      else input.value = selectedLabel;
    } else if (isMulti && filterQuery) {
      // Drop an in-progress filter query and show the committed summary again.
      syncMultiInputDisplay();
    }
  }

  function setMultiSelected(value, selected, { source = "api", emitEvent = true } = {}) {
    if (selected && !isSafeMultiValue(value)) {
      input.setAttribute("aria-invalid", "true");
      return false;
    }

    const option = optionRecords.find((record) => record.value === value);
    const label = option?.label ?? String(value);

    if (selected) {
      selectedMap.set(value, label);
    } else {
      selectedMap.delete(value);
    }

    setValueInputFromState();
    updateSelectionBadge();
    syncOptionSelectedState();
    syncListGridSelectionJoins(list, ".combobox-option");
    if (!selected) {
      option?.element.classList.remove("is-active");
    }
    input.removeAttribute("aria-invalid");

    // Keep an in-progress filter while the list stays open for further picks.
    if (!(isOpen && filterQuery)) {
      syncMultiInputDisplay();
    }

    if (emitEvent) {
      onToggle?.({
        comboboxEl,
        value,
        label,
        selected,
        values: selectedValues(),
        labels: selectedLabels(),
        source,
      });
      emitChange({ toggled: true, source });
    }
    return true;
  }

  function selectOption(option, { close = !isMulti } = {}) {
    if (!option) return;

    if (isMulti) {
      const next = !selectedMap.has(option.value);
      if (!setMultiSelected(option.value, next, { source: "select" })) {
        if (close) closeList({ restoreInput: true });
        return;
      }
      onSelect?.({
        comboboxEl,
        value: option.value,
        label: option.label,
        selected: next,
        values: selectedValues(),
        labels: selectedLabels(),
        option: option.element,
      });
      if (close) closeList();
      // Selection chrome is already synced in setMultiSelected — avoid re-render
      // (that would reset the active option and scroll the list).
      return;
    }

    selectedValue = option.value;
    selectedLabel = option.label;
    input.value = option.label;
    setValueInput(selectedValue);
    input.removeAttribute("aria-invalid");

    onSelect?.({
      comboboxEl,
      value: option.value,
      label: option.label,
      option: option.element,
    });
    emitChange({ selected: true });

    if (close) closeList();
  }

  function commitInput({ close = true } = {}) {
    if (isMulti) {
      const query = filterQuery.trim();
      const summary = multiSummary();
      const inputText = input.value.trim();

      // Committed summary is showing — nothing to commit.
      if (!query && inputText === summary) {
        input.removeAttribute("aria-invalid");
        if (close) closeList({ restoreInput: true });
        return true;
      }

      const text = query || inputText;

      // Empty filter / cleared field restores the summary — do not wipe selection.
      // Clear via setValues([]) / setValue("").
      if (!text) {
        input.removeAttribute("aria-invalid");
        if (close) closeList({ restoreInput: true });
        return true;
      }

      const matched = findOptionByLabel(optionRecords, text);
      if (matched) {
        selectOption(matched, { close });
        return true;
      }

      if (allowFreeText) {
        if (!isSafeMultiValue(text)) {
          syncMultiInputDisplay();
          input.setAttribute("aria-invalid", "true");
          emitChange({ committed: true, valid: false, reason: "comma" });
          if (close) closeList({ restoreInput: true });
          return false;
        }
        setMultiSelected(text, true, { source: "custom" });
        if (close) closeList();
        return true;
      }

      syncMultiInputDisplay();
      input.setAttribute("aria-invalid", "true");
      emitChange({ committed: true, valid: false });
      if (close) closeList({ restoreInput: true });
      return false;
    }

    const text = input.value.trim();

    if (!text) {
      selectedValue = "";
      selectedLabel = "";
      setValueInput("");
      input.removeAttribute("aria-invalid");
      emitChange({ committed: true });
      if (close) closeList();
      return true;
    }

    const matched = findOptionByLabel(optionRecords, text);
    if (matched) {
      selectOption(matched, { close });
      return true;
    }

    if (allowFreeText) {
      selectedValue = text;
      selectedLabel = text;
      setValueInput(text);
      input.removeAttribute("aria-invalid");
      emitChange({ committed: true, custom: true });
      if (close) closeList();
      return true;
    }

    input.value = selectedLabel;
    input.setAttribute("aria-invalid", "true");
    emitChange({ committed: true, valid: false });
    if (close) closeList();
    return false;
  }

  function onInputEvent() {
    if (isMulti) {
      const summary = multiSummary();
      // Summary is the display value until the user starts filtering. Typing into
      // the summary (cursor at end) would otherwise append into the labels string;
      // peel off the suffix, or take the whole value when they replace/delete.
      if (!filterQuery && summary && input.value.startsWith(summary)) {
        filterQuery = input.value.slice(summary.length);
        input.value = filterQuery;
      } else if (!filterQuery && input.value === summary) {
        filterQuery = "";
      } else {
        filterQuery = input.value;
      }
    }
    openList();
  }

  function onInputFocus() {
    input.removeAttribute("aria-invalid");
    if (isMulti && !filterQuery) {
      // Select the summary so the next keystroke replaces it with a filter query.
      requestAnimationFrame(() => {
        if (!filterQuery && input.value === multiSummary()) input.select();
      });
    }
    // Already open (e.g. after a multi-select click that re-focuses the input) —
    // do not re-render or the list jumps back to the active option.
    if (!isOpen) openList();
  }

  function onInputBlur(event) {
    const next = event.relatedTarget;
    if (next && comboboxEl.contains(next)) return;
    commitInput();
  }

  function onInputKeydown(event) {
    const visible = getVisibleOptions();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openList();
        return;
      }
      if (!visible.length) return;
      const currentVisibleIndex = visible.findIndex(
        (option) => optionRecords.indexOf(option) === activeIndex
      );
      const nextIndex = isGridListOpen()
        ? gridMenuIndexForKey(
            visible,
            currentVisibleIndex,
            "ArrowDown",
            getListGridColumns(list)
          )
        : currentVisibleIndex < 0
          ? 0
          : Math.min(currentVisibleIndex + 1, visible.length - 1);
      setActiveOption(nextIndex);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen || !visible.length) return;
      const currentVisibleIndex = visible.findIndex(
        (option) => optionRecords.indexOf(option) === activeIndex
      );
      const nextIndex = isGridListOpen()
        ? gridMenuIndexForKey(
            visible,
            currentVisibleIndex,
            "ArrowUp",
            getListGridColumns(list)
          )
        : currentVisibleIndex <= 0
          ? visible.length - 1
          : currentVisibleIndex - 1;
      setActiveOption(nextIndex);
      return;
    }

    if (
      isGridListOpen() &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      if (!isOpen || !visible.length) return;
      const currentVisibleIndex = visible.findIndex(
        (option) => optionRecords.indexOf(option) === activeIndex
      );
      const nextIndex = gridMenuIndexForKey(
        visible,
        currentVisibleIndex,
        event.key,
        getListGridColumns(list)
      );
      setActiveOption(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) return;
      event.preventDefault();
      if (activeIndex >= 0 && optionRecords[activeIndex]) {
        selectOption(optionRecords[activeIndex]);
        return;
      }
      commitInput();
      return;
    }

    if (event.key === "Escape") {
      if (!isOpen) return;
      event.preventDefault();
      closeList({ restoreInput: true });
    }
  }

  function onListClick(event) {
    const optionEl = event.target.closest(".combobox-option");
    if (!optionEl) return;
    const record = optionRecords.find((option) => option.element === optionEl);
    selectOption(record);
    if (isMulti && isOpen && record) {
      if (selectedMap.has(record.value)) {
        const visible = getVisibleOptions();
        const idx = visible.indexOf(record);
        if (idx >= 0) setActiveOption(idx, { scroll: false });
      }
    }
    input.focus();
  }

  let pressedOptionEl = null;
  let removePressedListeners = null;

  function clearPressedOption() {
    pressedOptionEl?.classList.remove("is-pressed");
    pressedOptionEl = null;
    if (removePressedListeners) {
      removePressedListeners();
      removePressedListeners = null;
    }
  }

  function onListPointerDown(event) {
    const optionEl = event.target.closest(".combobox-option");
    if (!optionEl) return;
    // Keep the input focused so blur does not close the list before click.
    // preventDefault also suppresses :active — `.is-pressed` is the press tint.
    event.preventDefault();
    clearPressedOption();
    pressedOptionEl = optionEl;
    optionEl.classList.add("is-pressed");
    const onUp = () => clearPressedOption();
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    removePressedListeners = () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }

  // Initial selection
  if (isMulti) {
    const fromOption =
      Array.isArray(defaultValues) && defaultValues.length
        ? defaultValues
        : defaultValue !== null && defaultValue !== undefined && defaultValue !== ""
          ? parseValueList(defaultValue)
          : parseValueList(valueInput?.value);

    const initial = fromOption.length
      ? fromOption
      : optionRecords.filter((option) => option.selected).map((option) => option.value);

    for (const value of initial) {
      if (!isSafeMultiValue(value)) continue;
      const match = optionRecords.find((option) => option.value === value);
      if (match) {
        selectedMap.set(match.value, match.label);
      } else if (allowFreeText) {
        selectedMap.set(value, value);
      }
    }

    setValueInputFromState();
    syncMultiInputDisplay();
    updateSelectionBadge();
  } else {
    selectedValue = defaultValue ?? valueInput?.value ?? "";
    syncSelectedLabel();

    if (selectedValue) {
      const match = optionRecords.find((option) => option.value === selectedValue);
      if (match) {
        input.value = match.label;
        setValueInput(selectedValue);
      } else if (allowFreeText) {
        input.value = selectedValue;
        selectedLabel = selectedValue;
        setValueInput(selectedValue);
      }
    }
  }

  input.addEventListener("input", onInputEvent);
  input.addEventListener("focus", onInputFocus);
  input.addEventListener("blur", onInputBlur);
  input.addEventListener("keydown", onInputKeydown);
  list.addEventListener("click", onListClick);
  list.addEventListener("mousedown", onListPointerDown);

  const removeClickOutside = onDocumentClickOutside((event) => {
    if (!comboboxEl.contains(event.target)) {
      commitInput();
      closeList();
    }
  });

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    closeList({ restoreInput: true });
    return true;
  }, { priority: 50 });

  renderList();
  emitChange();

  const api = {
    openList,
    closeList,
    commitInput,
    syncListGrid,
    getGridConfig,
    /** @param {number | false} min */
    setGridMin(min) {
      gridOverrides.gridMin = min;
      return syncListGrid();
    },
    /** @param {number} cols */
    setGridCols(cols) {
      gridOverrides.gridCols = cols;
      return syncListGrid();
    },
    getValue() {
      return isMulti ? selectedValues().join(",") : selectedValue;
    },
    getValues() {
      return isMulti ? selectedValues() : selectedValue ? [selectedValue] : [];
    },
    getLabel() {
      return isMulti ? multiSummary() : selectedLabel || input.value.trim();
    },
    getSelected() {
      return selectedEntries().map((entry) => ({
        ...entry,
        item: optionRecords.find((option) => option.value === entry.value)?.element,
      }));
    },
    setValue(value) {
      if (isMulti) {
        selectedMap.clear();
        for (const next of parseValueList(value)) {
          if (!isSafeMultiValue(next)) continue;
          const match = optionRecords.find((option) => option.value === next);
          if (match) selectedMap.set(match.value, match.label);
          else if (allowFreeText) selectedMap.set(next, next);
        }
        setValueInputFromState();
        syncMultiInputDisplay();
        updateSelectionBadge();
        renderList();
        emitChange();
        return;
      }

      const match = optionRecords.find((option) => option.value === value);
      if (match) {
        selectOption(match, { close: false });
        renderList();
        return;
      }

      if (allowFreeText && value) {
        selectedValue = value;
        selectedLabel = value;
        input.value = value;
        setValueInput(value);
        renderList();
        emitChange();
        return;
      }

      selectedValue = "";
      selectedLabel = "";
      input.value = "";
      setValueInput("");
      renderList();
      emitChange();
    },
    setValues(values) {
      api.setValue(isMulti ? values : parseValueList(values)[0] ?? "");
    },
    setOptions(nextOptions) {
      if (isMulti) {
        const previous = selectedValues();
        applyOptions(nextOptions);
        selectedMap.clear();
        for (const value of previous) {
          if (!isSafeMultiValue(value)) continue;
          const match = optionRecords.find((option) => option.value === value);
          if (match) selectedMap.set(match.value, match.label);
          else if (allowFreeText) selectedMap.set(value, value);
        }
        setValueInputFromState();
        syncMultiInputDisplay();
        updateSelectionBadge();
        renderList();
        return;
      }

      const previousValue = selectedValue;
      applyOptions(nextOptions);
      syncSelectedLabel();
      if (previousValue) {
        const match = optionRecords.find((option) => option.value === previousValue);
        if (match) {
          input.value = match.label;
        }
      }
      renderList();
    },
    destroy() {
      input.removeEventListener("input", onInputEvent);
      input.removeEventListener("focus", onInputFocus);
      input.removeEventListener("blur", onInputBlur);
      input.removeEventListener("keydown", onInputKeydown);
      list.removeEventListener("click", onListClick);
      list.removeEventListener("mousedown", onListPointerDown);
      clearPressedOption();
      comboboxEl.classList.remove("is-popup-open");
      unregisterOpenPopup(closeList);
      removeClickOutside();
      removeEscape();
    },
  };

  return api;
}

/** Wire every `.combobox` block in `root`. */
export function initComboboxes(root = document) {
  const instances = [];
  root.querySelectorAll(".combobox").forEach((comboboxEl) => {
    const instance = initCombobox(comboboxEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
