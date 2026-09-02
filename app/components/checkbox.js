/**
 * Tri-state checkbox — cycles unchecked → checked → mixed (indeterminate).
 *
 * Markup:
 *   <label class="checkbox">
 *     <input type="checkbox" class="checkbox-input"
 *       data-checkbox-tristate data-checkbox-default="mixed" />
 *     <span>Some selected</span>
 *   </label>
 *
 * Prefer a wrapping `<label>` without a matching `for` (or `for` without wrapping)
 * so the control is not activated twice per click.
 *
 * data-checkbox-tristate — opt in (required for initTriStateCheckboxes scan)
 * data-checkbox-default — "true" / "false" / "mixed" (or presence for checked)
 * data-checkbox-disabled — disable the control
 *
 * Native `.indeterminate` is set for the mixed state; `aria-checked` mirrors it.
 */

import { parseBooleanAttr } from "../utils/dom.js";

/** @typedef {"true" | "false" | "mixed"} CheckboxState */

const STATES = /** @type {const} */ (["false", "true", "mixed"]);

/**
 * @param {unknown} value
 * @returns {CheckboxState}
 */
export function normalizeCheckboxState(value) {
  if (value === "mixed" || value === "indeterminate") return "mixed";
  if (value === true || value === "true" || value === "") return "true";
  if (value === false || value === "false") return "false";
  return "false";
}

/**
 * @param {CheckboxState} state
 * @returns {CheckboxState}
 */
function nextState(state) {
  const index = STATES.indexOf(state);
  return STATES[(index + 1) % STATES.length];
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {CheckboxState | boolean | string | undefined} defaultStateOption
 * @returns {CheckboxState}
 */
function resolveDefaultState(inputEl, defaultStateOption) {
  if (defaultStateOption !== undefined) {
    return normalizeCheckboxState(defaultStateOption);
  }
  const fromAttr = inputEl.dataset.checkboxDefault;
  if (fromAttr !== undefined) {
    if (fromAttr === "mixed" || fromAttr === "indeterminate") return "mixed";
    return parseBooleanAttr(fromAttr) ? "true" : "false";
  }
  if (inputEl.indeterminate) return "mixed";
  return inputEl.checked ? "true" : "false";
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {boolean | undefined} disabledOption
 */
function resolveDisabled(inputEl, disabledOption) {
  if (typeof disabledOption === "boolean") return disabledOption;
  if (parseBooleanAttr(inputEl.dataset.checkboxDisabled)) return true;
  return inputEl.disabled;
}

/**
 * Apply checked / indeterminate in an order browsers reliably paint.
 * @param {HTMLInputElement} inputEl
 * @param {CheckboxState} state
 */
function applyDomState(inputEl, state) {
  if (state === "mixed") {
    inputEl.checked = false;
    inputEl.indeterminate = true;
  } else {
    // Clear indeterminate before checked — otherwise the dash can stick.
    inputEl.indeterminate = false;
    inputEl.checked = state === "true";
  }
  inputEl.setAttribute("aria-checked", state);
}

/**
 * @param {HTMLInputElement | null} inputEl
 * @param {{
 *   defaultState?: CheckboxState | boolean | string,
 *   disabled?: boolean,
 *   onChange?: (detail: {
 *     inputEl: HTMLInputElement,
 *     state: CheckboxState,
 *     checked: boolean,
 *     indeterminate: boolean,
 *     source: string,
 *   }) => void,
 * }} [options]
 */
export function initTriStateCheckbox(
  inputEl,
  { defaultState, disabled, onChange } = {}
) {
  if (!(inputEl instanceof HTMLInputElement) || inputEl.type !== "checkbox") {
    return null;
  }

  let state = resolveDefaultState(inputEl, defaultState);
  let isDisabled = resolveDisabled(inputEl, disabled);
  /** Ignore duplicate activations from label `for` + wrapping in one gesture. */
  let cycleLock = false;

  function syncDom({ emit = true, source = "init" } = {}) {
    applyDomState(inputEl, state);
    inputEl.disabled = isDisabled;

    if (emit) {
      onChange?.({
        inputEl,
        state,
        checked: state === "true",
        indeterminate: state === "mixed",
        source,
      });
    }
  }

  /**
   * @param {CheckboxState | boolean | string} next
   * @param {{ emit?: boolean, source?: string }} [opts]
   */
  function setState(next, { emit = true, source = "api" } = {}) {
    const normalized = normalizeCheckboxState(next);
    if (normalized === state) {
      syncDom({ emit: false });
      return;
    }
    state = normalized;
    syncDom({ emit, source });
  }

  function applyDisabled(nextDisabled) {
    isDisabled = Boolean(nextDisabled);
    syncDom({ emit: false });
  }

  function onClick(event) {
    if (isDisabled) return;
    // Replace the native binary toggle with an explicit three-state cycle.
    event.preventDefault();
    event.stopPropagation();
    if (cycleLock) return;
    cycleLock = true;

    state = nextState(state);
    syncDom({ emit: true, source: "click" });

    // Native click handling can clear `indeterminate` after listeners; re-assert.
    requestAnimationFrame(() => {
      applyDomState(inputEl, state);
      cycleLock = false;
    });
  }

  inputEl.addEventListener("click", onClick);
  syncDom({ emit: Boolean(onChange) });

  return {
    getState() {
      return state;
    },
    setState(next) {
      setState(next);
    },
    getChecked() {
      return state === "true";
    },
    isIndeterminate() {
      return state === "mixed";
    },
    cycle() {
      setState(nextState(state), { source: "api" });
    },
    setDisabled(nextDisabled) {
      applyDisabled(nextDisabled);
    },
    isDisabled() {
      return isDisabled;
    },
    destroy() {
      inputEl.removeEventListener("click", onClick);
    },
  };
}

/** Wire every `[data-checkbox-tristate]` checkbox in `root`. */
export function initTriStateCheckboxes(root = document) {
  const instances = [];
  root.querySelectorAll("input.checkbox-input[data-checkbox-tristate]").forEach((el) => {
    const instance = initTriStateCheckbox(/** @type {HTMLInputElement} */ (el));
    if (instance) instances.push(instance);
  });
  return instances;
}
