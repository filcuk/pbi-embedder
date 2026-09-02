/**
 * Colour-set panel rendering (set switcher + swatch grid).
 */

/**
 * @param {object} options
 * @param {HTMLSelectElement | null} options.selectEl
 * @param {HTMLElement | null} options.gridEl
 * @param {import('./registry.js').ColorSet[]} options.sets
 * @param {string} options.activeSetId
 * @param {string | null} options.selectedHex
 * @param {(setId: string) => void} options.onSetChange
 * @param {(payload: { hex: string, name?: string, setId: string }) => void} options.onSwatchSelect
 */
export function renderColorSetPanel({
  selectEl,
  gridEl,
  sets,
  activeSetId,
  selectedHex,
  onSetChange,
  onSwatchSelect,
}) {
  if (selectEl) {
    const previous = selectEl.value;
    selectEl.replaceChildren();
    for (const set of sets) {
      const option = document.createElement("option");
      option.value = set.id;
      option.textContent = set.name;
      selectEl.append(option);
    }
    const nextValue = sets.some((set) => set.id === activeSetId)
      ? activeSetId
      : sets[0]?.id ?? "";
    selectEl.value = nextValue;
    if (!selectEl.dataset.colorSetBound) {
      selectEl.addEventListener("change", () => {
        onSetChange(selectEl.value);
      });
      selectEl.dataset.colorSetBound = "true";
    } else if (previous !== selectEl.value) {
      // value synced above
    }
  }

  if (!gridEl) return;

  const activeSet = sets.find((set) => set.id === activeSetId) ?? sets[0] ?? null;
  gridEl.replaceChildren();
  if (!activeSet) return;

  for (const color of activeSet.colors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-set-swatch";
    button.setAttribute("role", "option");
    button.dataset.hex = color.hex;
    button.style.setProperty("--color-set-swatch", color.hex);

    const label = color.name || color.hex;
    button.setAttribute("aria-label", label);
    if (color.name) {
      button.dataset.tooltip = color.name;
    }

    const isSelected =
      selectedHex !== null &&
      selectedHex !== undefined &&
      selectedHex.toUpperCase() === color.hex.toUpperCase();
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-selected", isSelected ? "true" : "false");

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onSwatchSelect({
        hex: color.hex,
        name: color.name,
        setId: activeSet.id,
      });
    });

    gridEl.append(button);
  }
}
