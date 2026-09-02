import { initPopupMenu } from "../utils/menu.js";

/**
 * @param {HTMLElement | null} dropdownEl
 * @param {{
 *   onSelect?: (detail: object) => void;
 *   gridMin?: number | false;
 *   gridCols?: number;
 * }} [options]
 */
export function initDropdown(dropdownEl, { onSelect, gridMin, gridCols } = {}) {
  if (!dropdownEl) return null;

  const trigger = dropdownEl.querySelector(".dropdown-trigger");
  const menu = dropdownEl.querySelector(".dropdown-menu");

  return initPopupMenu({
    containerEl: dropdownEl,
    menuEl: menu,
    toggleEl: trigger,
    itemSelector: ".dropdown-menu-item",
    gridMin,
    gridCols,
    onSelect: (detail) => onSelect?.({ dropdownEl, ...detail }),
  });
}
