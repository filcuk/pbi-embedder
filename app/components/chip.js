/**
 * Chips — selectable filter tags and removable input chips.
 *
 * Selectable group (static; toggle pressed, not removed):
 *   <div class="chip-group" role="group" aria-label="Categories">
 *     <button type="button" class="chip" aria-pressed="false" data-chip-value="docs">Docs</button>
 *   </div>
 *
 * Input chips (type to add; click a chip to remove):
 *   <div class="chip-input">
 *     <label class="field-label" for="filters-input">Filters</label>
 *     <div class="chip-input-control">
 *       <input type="text" id="filters-input" class="input chip-input-field"
 *         placeholder="Add filter…" autocomplete="off" />
 *     </div>
 *     <div class="chip-input-list"></div>
 *   </div>
 *
 * data-chip-input-disabled — disable the input chip field
 */

import { parseBooleanAttr } from "../utils/dom.js";

function readChipValue(chipEl) {
  return chipEl.dataset.chipValue ?? chipEl.textContent.trim();
}

function readChipLabel(chipEl) {
  const labelEl = chipEl.querySelector(".chip-label");
  return (labelEl?.textContent ?? chipEl.textContent).trim();
}

/**
 * Static chip group — chips toggle selected/pressed; they cannot be removed.
 * @param {HTMLElement | null} groupEl
 */
export function initChipGroup(groupEl, { onChange } = {}) {
  if (!groupEl) return null;

  const chips = () => [...groupEl.querySelectorAll(":scope > .chip, :scope > button.chip")];

  function getSelected() {
    return chips()
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => ({
        value: readChipValue(chip),
        label: readChipLabel(chip),
        element: chip,
      }));
  }

  function emit(source) {
    const selected = getSelected();
    onChange?.({
      groupEl,
      selected,
      values: selected.map((item) => item.value),
      labels: selected.map((item) => item.label),
      source,
    });
  }

  function setPressed(chip, pressed, { emitEvent = true, source = "api" } = {}) {
    chip.setAttribute("aria-pressed", pressed ? "true" : "false");
    chip.classList.toggle("is-selected", pressed);
    if (emitEvent) emit(source);
  }

  function onChipClick(event) {
    const chip = event.target.closest(".chip");
    if (!chip || !groupEl.contains(chip) || chip.disabled) return;
    const next = chip.getAttribute("aria-pressed") !== "true";
    setPressed(chip, next, { source: "click" });
  }

  for (const chip of chips()) {
    if (!chip.hasAttribute("aria-pressed")) {
      chip.setAttribute("aria-pressed", "false");
    }
    chip.classList.toggle("is-selected", chip.getAttribute("aria-pressed") === "true");
  }

  groupEl.addEventListener("click", onChipClick);

  return {
    getSelected,
    getValues() {
      return getSelected().map((item) => item.value);
    },
    setSelected(values, { emitEvent = true } = {}) {
      const wanted = new Set((values ?? []).map(String));
      for (const chip of chips()) {
        setPressed(chip, wanted.has(String(readChipValue(chip))), {
          emitEvent: false,
        });
      }
      if (emitEvent) emit("api");
    },
    clear({ emitEvent = true } = {}) {
      for (const chip of chips()) {
        setPressed(chip, false, { emitEvent: false });
      }
      if (emitEvent) emit("clear");
    },
    destroy() {
      groupEl.removeEventListener("click", onChipClick);
    },
  };
}

function normalizeChipToken(raw) {
  return String(raw ?? "").trim();
}

function tokensFromInput(raw) {
  return String(raw ?? "")
    .split(/[,;\n]+/)
    .map(normalizeChipToken)
    .filter(Boolean);
}

/**
 * Chip input — add chips from text (Enter or comma); click a chip to remove.
 * @param {HTMLElement | null} inputEl
 */
export function initChipInput(inputEl, { values, disabled, onChange } = {}) {
  if (!inputEl) return null;

  const controlEl = inputEl.querySelector(".chip-input-control");
  const listEl = inputEl.querySelector(".chip-input-list");
  const fieldEl = inputEl.querySelector(".chip-input-field");
  const hiddenInput = inputEl.querySelector(".chip-input-value");

  if (!controlEl || !listEl || !fieldEl) return null;

  let isDisabled =
    typeof disabled === "boolean"
      ? disabled
      : parseBooleanAttr(inputEl.dataset.chipInputDisabled) ?? fieldEl.disabled;

  /** @type {{ value: string, label: string }[]} */
  let items = [];

  function syncHidden() {
    if (hiddenInput) {
      hiddenInput.value = items.map((item) => item.value).join(",");
    }
  }

  function emit(source) {
    onChange?.({
      inputEl,
      values: items.map((item) => item.value),
      labels: items.map((item) => item.label),
      items: items.map((item) => ({ ...item })),
      source,
    });
  }

  function render() {
    listEl.replaceChildren();

    for (const item of items) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip chip--removable";
      chip.dataset.chipValue = item.value;
      chip.setAttribute("aria-label", `Remove ${item.label}`);
      chip.disabled = isDisabled;

      const label = document.createElement("span");
      label.className = "chip-label";
      label.textContent = item.label;

      chip.append(label);
      chip.addEventListener("click", (event) => {
        event.preventDefault();
        removeValue(item.value, { source: "remove" });
      });

      listEl.append(chip);
    }

    syncHidden();
    fieldEl.disabled = isDisabled;
    inputEl.classList.toggle("chip-input--disabled", isDisabled);
  }

  function hasValue(value) {
    const key = String(value).toLowerCase();
    return items.some((item) => item.value.toLowerCase() === key);
  }

  function addValues(rawValues, { emitEvent = true, source = "add" } = {}) {
    if (isDisabled) return;
    let added = false;
    for (const raw of rawValues) {
      const label = normalizeChipToken(raw);
      if (!label || hasValue(label)) continue;
      items.push({ value: label, label });
      added = true;
    }
    if (!added) return;
    render();
    if (emitEvent) emit(source);
  }

  function removeValue(value, { emitEvent = true, source = "remove" } = {}) {
    const key = String(value).toLowerCase();
    const next = items.filter((item) => item.value.toLowerCase() !== key);
    if (next.length === items.length) return;
    items = next;
    render();
    if (emitEvent) emit(source);
  }

  function commitField({ emitEvent = true } = {}) {
    const tokens = tokensFromInput(fieldEl.value);
    if (!tokens.length) return;
    fieldEl.value = "";
    addValues(tokens, { emitEvent, source: "input" });
  }

  function onFieldKeydown(event) {
    if (isDisabled) return;

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitField();
    }
  }

  function onFieldBlur() {
    commitField({ emitEvent: true });
  }

  function onControlClick() {
    if (isDisabled) return;
    fieldEl.focus();
  }

  const initial =
    Array.isArray(values) && values.length
      ? values
      : tokensFromInput(hiddenInput?.value ?? "");

  if (initial.length) {
    addValues(initial, { emitEvent: false, source: "init" });
  } else {
    render();
  }

  fieldEl.addEventListener("keydown", onFieldKeydown);
  fieldEl.addEventListener("blur", onFieldBlur);
  controlEl.addEventListener("click", onControlClick);

  return {
    getValues() {
      return items.map((item) => item.value);
    },
    getItems() {
      return items.map((item) => ({ ...item }));
    },
    setValues(nextValues, { emitEvent = true } = {}) {
      items = [];
      for (const raw of nextValues ?? []) {
        const label = normalizeChipToken(raw);
        if (!label || hasValue(label)) continue;
        items.push({ value: label, label });
      }
      render();
      if (emitEvent) emit("api");
    },
    add(value) {
      addValues([value], { source: "api" });
    },
    remove(value) {
      removeValue(value, { source: "api" });
    },
    clear({ emitEvent = true } = {}) {
      items = [];
      render();
      if (emitEvent) emit("clear");
    },
    setDisabled(next) {
      isDisabled = Boolean(next);
      render();
    },
    destroy() {
      fieldEl.removeEventListener("keydown", onFieldKeydown);
      fieldEl.removeEventListener("blur", onFieldBlur);
      controlEl.removeEventListener("click", onControlClick);
    },
  };
}

/** Wire every `.chip-group` in `root`. */
export function initChipGroups(root = document) {
  const instances = [];
  root.querySelectorAll(".chip-group").forEach((el) => {
    const instance = initChipGroup(el);
    if (instance) instances.push(instance);
  });
  return instances;
}

/** Wire every `.chip-input` in `root`. */
export function initChipInputs(root = document) {
  const instances = [];
  root.querySelectorAll(".chip-input").forEach((el) => {
    const instance = initChipInput(el);
    if (instance) instances.push(instance);
  });
  return instances;
}
