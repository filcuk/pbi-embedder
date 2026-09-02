/**
 * Segmented control (toggle button group) — single selection among joined options.
 *
 * Markup:
 *   <div class="segmented-control" data-segmented-control-default="list">
 *     <div class="segmented-control-list" role="radiogroup" aria-label="View mode">
 *       <button type="button" class="segmented-control-item" role="radio"
 *         aria-checked="true" data-segmented-control-value="list">List</button>
 *       <button type="button" class="segmented-control-item" role="radio"
 *         aria-checked="false" data-segmented-control-value="grid">Grid</button>
 *     </div>
 *     <input type="hidden" class="segmented-control-value" name="view" value="list" />
 *   </div>
 *
 * Optional panels — pair items with panels via aria-controls (like tabs):
 *   <button ... aria-controls="panel-list" id="seg-list">List</button>
 *   <div class="segmented-control-panels">
 *     <div class="segmented-control-panel" id="panel-list" role="region" aria-labelledby="seg-list">…</div>
 *   </div>
 *
 * data-segmented-control-default — initial value (matches data-segmented-control-value)
 * data-segmented-control-disabled — disable the whole control
 *
 * Default height matches `.btn` (`--control-height`). Add `.segmented-control--slim`
 * for the compact size.
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";

function getItemValue(item) {
  return item.dataset.segmentedControlValue ?? item.value ?? item.textContent?.trim() ?? "";
}

function getItemIndex(items, item) {
  return items.indexOf(item);
}

function resolveDefaultValue(controlEl, items, defaultValueOption) {
  if (defaultValueOption !== undefined) return String(defaultValueOption);

  const fromAttr = controlEl?.dataset.segmentedControlDefault;
  if (fromAttr !== undefined) return fromAttr;

  const hiddenInput = controlEl.querySelector(".segmented-control-value");
  if (hiddenInput?.value) return hiddenInput.value;

  const checked = items.find((item) => item.getAttribute("aria-checked") === "true");
  if (checked) return getItemValue(checked);

  const firstEnabled = items.find((item) => !item.disabled);
  return firstEnabled ? getItemValue(firstEnabled) : getItemValue(items[0]);
}

function resolveDisabled(controlEl, disabledOption, listEl) {
  if (typeof disabledOption === "boolean") return disabledOption;
  if (parseBooleanAttr(controlEl?.dataset.segmentedControlDisabled)) return true;
  return listEl?.getAttribute("aria-disabled") === "true";
}

export function initSegmentedControl(
  controlEl,
  { defaultValue, disabled, onChange } = {}
) {
  if (!controlEl) return null;

  const listEl = controlEl.querySelector(".segmented-control-list");
  const items = [...controlEl.querySelectorAll(".segmented-control-item[role='radio']")];
  const hiddenInput = controlEl.querySelector(".segmented-control-value");

  if (!listEl || !items.length) return null;

  const panels = items
    .map((item) => {
      const panelId = item.getAttribute("aria-controls");
      return panelId ? document.getElementById(panelId) : null;
    })
    .filter(Boolean);

  const hasPanels = panels.length > 0 && panels.length === items.length;

  let activeValue = resolveDefaultValue(controlEl, items, defaultValue);
  let isDisabled = resolveDisabled(controlEl, disabled, listEl);

  function findItemByValue(value) {
    return items.find((item) => getItemValue(item) === value);
  }

  function findEnabledIndexForValue(value) {
    const item = findItemByValue(value);
    if (!item || item.disabled) {
      const fallback = items.find((item) => !item.disabled);
      return fallback ? getItemIndex(items, fallback) : 0;
    }
    return getItemIndex(items, item);
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    const activeIndex = findEnabledIndexForValue(activeValue);
    activeValue = getItemValue(items[activeIndex]);

    items.forEach((item, index) => {
      const selected = index === activeIndex;
      item.setAttribute("aria-checked", selected ? "true" : "false");
      item.tabIndex = selected ? 0 : -1;
    });

    if (hasPanels) {
      panels.forEach((panel, index) => {
        setHidden(panel, index !== activeIndex);
      });
    }

    listEl.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    controlEl.classList.toggle("segmented-control--disabled", isDisabled);

    items.forEach((item) => {
      if (isDisabled) {
        item.setAttribute("aria-disabled", "true");
      } else {
        item.removeAttribute("aria-disabled");
      }
    });

    if (hiddenInput) {
      hiddenInput.value = activeValue;
      hiddenInput.disabled = isDisabled;
    }

    if (emit) {
      onChange?.({
        controlEl,
        value: activeValue,
        index: activeIndex,
        item: items[activeIndex],
        panel: hasPanels ? panels[activeIndex] : null,
        source,
      });
    }
  }

  function selectIndex(index, { emit = true, source = "api" } = {}) {
    if (index < 0 || index >= items.length) return;
    if (isDisabled || items[index].disabled) return;

    const nextValue = getItemValue(items[index]);
    if (nextValue === activeValue) {
      syncDom({ emit: false });
      return;
    }

    activeValue = nextValue;
    syncDom({ emit, source });
  }

  function selectValue(value, options = {}) {
    const item = findItemByValue(String(value));
    if (!item) return;
    selectIndex(getItemIndex(items, item), options);
  }

  function applyDisabled(nextDisabled) {
    isDisabled = Boolean(nextDisabled);
    syncDom({ emit: false });
  }

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (isDisabled || item.disabled) return;
      selectIndex(index, { source: "click" });
    });
  });

  listEl.addEventListener("keydown", (e) => {
    if (isDisabled) return;

    const current = getItemIndex(items, document.activeElement);
    if (current === -1) return;

    let next = current;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (current + 1) % items.length;
      while (items[next].disabled && next !== current) {
        next = (next + 1) % items.length;
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (current - 1 + items.length) % items.length;
      while (items[next].disabled && next !== current) {
        next = (next - 1 + items.length) % items.length;
      }
    } else if (e.key === "Home") {
      next = items.findIndex((item) => !item.disabled);
      if (next === -1) return;
    } else if (e.key === "End") {
      next = items.length - 1 - [...items].reverse().findIndex((item) => !item.disabled);
      if (next < 0 || next >= items.length) return;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      selectIndex(current, { source: "keyboard" });
      return;
    } else {
      return;
    }

    if (items[next].disabled) return;

    e.preventDefault();
    selectIndex(next, { source: "keyboard" });
    items[next].focus();
  });

  syncDom({ emit: Boolean(onChange) });

  return {
    selectValue(value, options) {
      selectValue(value, { ...options, source: options?.source ?? "api" });
    },
    selectIndex(index, options) {
      selectIndex(index, { ...options, source: options?.source ?? "api" });
    },
    getValue() {
      return activeValue;
    },
    getActiveIndex() {
      return findEnabledIndexForValue(activeValue);
    },
    setDisabled(nextDisabled) {
      applyDisabled(nextDisabled);
    },
    isDisabled() {
      return isDisabled;
    },
  };
}

/** Wire every `.segmented-control` block in `root`. */
export function initSegmentedControls(root = document) {
  const instances = [];
  root.querySelectorAll(".segmented-control").forEach((controlEl) => {
    const instance = initSegmentedControl(controlEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
