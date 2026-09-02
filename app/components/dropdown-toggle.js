import { initBadge } from "./badge.js";
import { setHidden } from "../utils/dom.js";
import { initPopupMenu, menuItemLabel, syncListGridSelectionJoins } from "../utils/menu.js";

function isItemSelected(item) {
  return item.getAttribute("aria-checked") === "true";
}

function setItemSelected(item, selected) {
  item.setAttribute("aria-checked", selected ? "true" : "false");
  item.classList.toggle("is-selected", selected);
}

function syncSelectionJoins(menu) {
  syncListGridSelectionJoins(menu, ".dropdown-menu-item");
}

function getMenuItems(menu, itemSelector) {
  return [...menu.querySelectorAll(itemSelector)];
}

function getSelectedItems(menu, itemSelector) {
  return getMenuItems(menu, itemSelector).filter(isItemSelected);
}

/** Strip a legacy trailing “ (n)” count from scraped trigger text only. */
function stripLegacySelectionCount(label) {
  return label.replace(/\s*\(\d+\)\s*$/, "").trim();
}

function readBaseLabel(dropdownEl, trigger) {
  const fromData = dropdownEl.dataset.toggleDropdownLabel?.trim();
  if (fromData) return fromData;

  const labelEl = trigger?.querySelector(".dropdown-trigger-label");
  if (labelEl) return labelEl.textContent.trim();

  if (!trigger) return "";

  const clone = trigger.cloneNode(true);
  clone.querySelector(".combo-btn-chevron")?.remove();
  // Legacy markup baked the selection count into the trigger text (e.g. "Items (3)").
  return stripLegacySelectionCount(clone.textContent.replace(/\s+/g, " "));
}

function ensureTriggerLabelEl(trigger, baseLabel) {
  let labelEl = trigger.querySelector(".dropdown-trigger-label");
  if (labelEl) {
    labelEl.textContent = baseLabel;
    return labelEl;
  }

  labelEl = document.createElement("span");
  labelEl.className = "dropdown-trigger-label";
  labelEl.textContent = baseLabel;

  const chevron = trigger.querySelector(".combo-btn-chevron");
  if (chevron) {
    while (trigger.firstChild && trigger.firstChild !== chevron) {
      trigger.removeChild(trigger.firstChild);
    }
    trigger.insertBefore(labelEl, chevron);
  } else {
    trigger.prepend(labelEl);
  }

  return labelEl;
}

/**
 * Prefer an existing `.badge-host` around the trigger; otherwise wrap the trigger
 * and add a normal `.badge` for the selection count.
 */
function ensureSelectionBadgeHost(dropdownEl, trigger, baseLabel) {
  let host = trigger.closest(".badge-host");
  if (!host || !dropdownEl.contains(host)) {
    host = document.createElement("span");
    host.className = "badge-host";
    trigger.parentNode?.insertBefore(host, trigger);
    host.appendChild(trigger);
  }

  if (baseLabel && !host.dataset.badgeLabel) {
    host.dataset.badgeLabel = baseLabel;
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

/**
 * Dropdown menu where each item toggles on/off; menu stays open until dismissed.
 *
 * Markup: same as {@link initDropdown} but use `role="menuitemcheckbox"` and
 * `aria-checked="true|false"` on each `.dropdown-menu-item`.
 *
 * Selection count is shown with a {@link initBadge} on the trigger (wrap the
 * trigger in `.badge-host` with a `.badge`, or let this init create that markup).
 * Base label: `.dropdown-trigger-label` or `data-toggle-dropdown-label`.
 *
 * @param {HTMLElement | null} dropdownEl
 * @param {{
 *   onToggle?: (detail: object) => void;
 *   gridMin?: number | false;
 *   gridCols?: number;
 * }} [options]
 */
export function initToggleDropdown(dropdownEl, { onToggle, gridMin, gridCols } = {}) {
  if (!dropdownEl) return null;

  const trigger = dropdownEl.querySelector(".dropdown-trigger");
  const menu = dropdownEl.querySelector(".dropdown-menu");
  const itemSelector = ".dropdown-menu-item";

  if (!menu || !trigger) return null;

  const baseLabel = readBaseLabel(dropdownEl, trigger);
  ensureTriggerLabelEl(trigger, baseLabel);

  const badgeHost = ensureSelectionBadgeHost(dropdownEl, trigger, baseLabel);
  const selectionBadge = initBadge(badgeHost, { value: 0 });

  function updateSelectionCount() {
    const count = getSelectedItems(menu, itemSelector).length;
    selectionBadge?.setValue(count);
  }

  for (const item of getMenuItems(menu, itemSelector)) {
    setItemSelected(item, isItemSelected(item));
  }
  updateSelectionCount();
  syncSelectionJoins(menu);

  const menuControl = initPopupMenu({
    containerEl: dropdownEl,
    menuEl: menu,
    toggleEl: trigger,
    itemSelector,
    closeOnSelect: false,
    gridMin,
    gridCols,
    onSelect: ({ item, value, label }) => {
      const selected = !isItemSelected(item);
      setItemSelected(item, selected);
      syncSelectionJoins(menu);

      const selectedItems = getSelectedItems(menu, itemSelector);
      updateSelectionCount();

      onToggle?.({
        dropdownEl,
        item,
        value,
        label,
        selected,
        values: selectedItems.map((el) => el.dataset.value).filter(Boolean),
        labels: selectedItems.map((el) => menuItemLabel(el)),
      });
    },
  });

  if (!menuControl) return null;

  return {
    ...menuControl,
    getSelected() {
      return getSelectedItems(menu, itemSelector).map((item) => ({
        value: item.dataset.value,
        label: menuItemLabel(item),
        item,
      }));
    },
    setSelected(values) {
      const valueSet = new Set(values);
      for (const item of getMenuItems(menu, itemSelector)) {
        const value = item.dataset.value;
        setItemSelected(item, valueSet.has(value));
      }
      updateSelectionCount();
      syncSelectionJoins(menu);
    },
  };
}
