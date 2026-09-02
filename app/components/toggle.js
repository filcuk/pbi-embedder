/**
 * On/off switch control (optional tri-state / mixed).
 *
 * Markup:
 *   <div class="toggle" data-toggle-default="false">
 *     <button type="button" class="toggle-btn" role="switch" aria-checked="false">
 *       <span class="toggle-track" aria-hidden="true">
 *         <span class="toggle-thumb">
 *           <span data-icon="check" data-icon-class="toggle-thumb-icon toggle-thumb-icon--on" aria-hidden="true"></span>
 *         </span>
 *       </span>
 *       <span class="toggle-label">Notifications</span>
 *     </button>
 *     <input type="hidden" class="toggle-value" />
 *   </div>
 *
 * Tri-state (`data-toggle-tristate`): cycles off → mixed → on by default. Uses
 * `role="checkbox"` with `aria-checked="mixed"` (ARIA switch is boolean-only).
 * Include a `remove` (minus) icon with `.toggle-thumb-icon--mixed`, or one is
 * injected automatically.
 *
 * data-toggle-default — "true" / "false" / "mixed" (tristate), or presence for on
 * data-toggle-tristate — enable three-state cycling
 * data-toggle-tristate-cycle — "default" (off → mixed → on), "on-mixed"
 *   (off → on → mixed), or "mixed-both" (off → mixed → on → mixed)
 * data-toggle-disabled — disable the switch
 *
 * Add `.toggle--slim` for a thin track with an oversized overhanging thumb
 * (no icon; CSS hides thumb icons if present).
 */

import { parseBooleanAttr } from "../utils/dom.js";
import { initIcons } from "../utils/icons.js";

/** @typedef {"true" | "false" | "mixed"} ToggleState */
/** @typedef {"default" | "on-mixed" | "mixed-both"} TristateCycleId */

/** @type {Record<TristateCycleId, readonly ToggleState[]>} */
export const TRISTATE_CYCLES = {
  default: ["false", "mixed", "true"],
  "on-mixed": ["false", "true", "mixed"],
  "mixed-both": ["false", "mixed", "true", "mixed"],
};

/**
 * @param {unknown} value
 * @returns {TristateCycleId}
 */
export function normalizeTristateCycleId(value) {
  // "mixed-on" is accepted as an alias of the default cycle.
  if (value === "on-mixed" || value === "mixed-both") return value;
  return "default";
}

/**
 * @param {TristateCycleId | undefined} cycleId
 * @returns {readonly ToggleState[]}
 */
export function getTristateCycleSequence(cycleId) {
  return TRISTATE_CYCLES[normalizeTristateCycleId(cycleId)];
}

/**
 * @param {number} step
 * @param {readonly ToggleState[]} cycle
 * @returns {ToggleState}
 */
export function tristateStateAtStep(step, cycle) {
  const len = cycle.length;
  const index = ((step % len) + len) % len;
  return cycle[index];
}

/**
 * @param {ToggleState} state
 * @param {readonly ToggleState[]} cycle
 * @returns {number}
 */
export function tristateStepForState(state, cycle) {
  const index = cycle.indexOf(state);
  return index === -1 ? 0 : index;
}

/**
 * @param {number} step
 * @param {readonly ToggleState[]} cycle
 * @returns {number}
 */
export function nextTristateCycleStep(step, cycle) {
  return (step + 1) % cycle.length;
}

/**
 * @param {unknown} value
 * @param {boolean} allowMixed
 * @returns {ToggleState}
 */
function normalizeState(value, allowMixed) {
  if (allowMixed && (value === "mixed" || value === "indeterminate")) {
    return "mixed";
  }
  if (value === true || value === "true" || value === "") return "true";
  if (value === false || value === "false") return "false";
  return "false";
}

/**
 * @param {HTMLElement} toggleEl
 * @param {TristateCycleId | undefined} cycleOption
 * @returns {readonly ToggleState[]}
 */
function resolveTristateCycle(toggleEl, cycleOption) {
  const raw = cycleOption ?? toggleEl?.dataset.toggleTristateCycle;
  return getTristateCycleSequence(normalizeTristateCycleId(raw));
}

/**
 * @param {number} step
 * @param {readonly ToggleState[]} cycle
 * @returns {ToggleState}
 */
function cycleStateAt(step, cycle) {
  return tristateStateAtStep(step, cycle);
}

/**
 * @param {ToggleState} state
 * @param {readonly ToggleState[]} cycle
 * @returns {number}
 */
function cycleStepForState(state, cycle) {
  return tristateStepForState(state, cycle);
}

/**
 * @param {number} step
 * @param {readonly ToggleState[]} cycle
 * @returns {number}
 */
function nextCycleStep(step, cycle) {
  return nextTristateCycleStep(step, cycle);
}

function resolveDisabled(toggleEl, disabledOption, toggleBtn) {
  if (typeof disabledOption === "boolean") return disabledOption;
  if (parseBooleanAttr(toggleEl?.dataset.toggleDisabled)) return true;
  return toggleBtn.disabled;
}

/**
 * @param {HTMLElement} toggleEl
 * @param {boolean | string | undefined} defaultStateOption
 * @param {boolean} isTristate
 * @returns {ToggleState}
 */
function resolveDefaultState(toggleEl, defaultStateOption, isTristate) {
  if (defaultStateOption !== undefined) {
    return normalizeState(defaultStateOption, isTristate);
  }
  const fromAttr = toggleEl?.dataset.toggleDefault;
  if (fromAttr !== undefined) {
    return normalizeState(fromAttr, isTristate);
  }
  const hiddenInput = toggleEl.querySelector(".toggle-value");
  if (hiddenInput?.value) {
    return normalizeState(hiddenInput.value, isTristate);
  }
  const btn = toggleEl.querySelector(".toggle-btn");
  const aria = btn?.getAttribute("aria-checked");
  if (aria) return normalizeState(aria, isTristate);
  return "false";
}

/**
 * Ensure mixed-state minus icon exists in the thumb for tristate toggles.
 * @param {HTMLElement} toggleBtn
 */
function ensureMixedIcon(toggleBtn) {
  const thumb = toggleBtn.querySelector(".toggle-thumb");
  if (!thumb) return;

  const onIcon = thumb.querySelector(".toggle-thumb-icon--on, [data-icon='check']");
  if (onIcon && !onIcon.classList.contains("toggle-thumb-icon--on")) {
    onIcon.classList.add("toggle-thumb-icon", "toggle-thumb-icon--on");
  }

  if (thumb.querySelector(".toggle-thumb-icon--mixed, [data-icon='remove']")) {
    return;
  }

  const mixed = document.createElement("span");
  mixed.dataset.icon = "remove";
  mixed.dataset.iconClass = "toggle-thumb-icon toggle-thumb-icon--mixed";
  mixed.setAttribute("aria-hidden", "true");
  thumb.append(mixed);
}

export function initToggle(
  toggleEl,
  { defaultChecked, defaultState, disabled, tristate, tristateCycle, onChange } = {}
) {
  if (!toggleEl) return null;

  const toggleBtn = toggleEl.querySelector(".toggle-btn");
  const hiddenInput = toggleEl.querySelector(".toggle-value");

  if (!toggleBtn) return null;

  const isTristate =
    typeof tristate === "boolean"
      ? tristate
      : Boolean(parseBooleanAttr(toggleEl.dataset.toggleTristate));
  const tristateCycleId = normalizeTristateCycleId(
    tristateCycle ?? toggleEl.dataset.toggleTristateCycle
  );
  const tristateCycleSequence = isTristate
    ? resolveTristateCycle(toggleEl, tristateCycleId)
    : TRISTATE_CYCLES.default;

  const role = toggleBtn.getAttribute("role");
  if (isTristate) {
    // Switch role cannot express mixed; checkbox can.
    if (role !== "checkbox") toggleBtn.setAttribute("role", "checkbox");
    ensureMixedIcon(toggleBtn);
  } else if (role !== "switch") {
    return null;
  }

  const initialOption =
    defaultState !== undefined
      ? defaultState
      : defaultChecked !== undefined
        ? defaultChecked
        : undefined;

  let state = resolveDefaultState(toggleEl, initialOption, isTristate);
  let cycleStep = isTristate ? cycleStepForState(state, tristateCycleSequence) : 0;
  let isDisabled = resolveDisabled(toggleEl, disabled, toggleBtn);

  function advanceTristateCycle(source) {
    cycleStep = nextCycleStep(cycleStep, tristateCycleSequence);
    setState(cycleStateAt(cycleStep, tristateCycleSequence), { source });
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    toggleBtn.setAttribute("aria-checked", state);
    toggleEl.classList.toggle("is-on", state === "true");
    toggleEl.classList.toggle("is-mixed", state === "mixed");
    toggleBtn.disabled = isDisabled;
    toggleEl.classList.toggle("toggle--disabled", isDisabled);

    if (hiddenInput) {
      hiddenInput.value = state;
    }

    if (emit) {
      onChange?.({
        toggleEl,
        state,
        checked: state === "true",
        indeterminate: state === "mixed",
        source,
      });
    }
  }

  /**
   * @param {ToggleState | boolean | string} next
   * @param {{ emit?: boolean, source?: string }} [opts]
   */
  function setState(next, { emit = true, source = "api" } = {}) {
    const normalized = normalizeState(next, isTristate);
    if (normalized === state) {
      syncDom({ emit: false });
      return;
    }
    state = normalized;
    if (isTristate) {
      cycleStep = cycleStepForState(state, tristateCycleSequence);
    }
    syncDom({ emit, source });
  }

  function setChecked(nextChecked, { emit = true, source = "api" } = {}) {
    setState(nextChecked ? "true" : "false", { emit, source });
  }

  function applyDisabled(nextDisabled) {
    isDisabled = Boolean(nextDisabled);
    syncDom({ emit: false });
  }

  toggleBtn.addEventListener("click", () => {
    if (isDisabled) return;
    if (isTristate) {
      advanceTristateCycle("click");
      return;
    }
    setChecked(state !== "true", { source: "click" });
  });

  syncDom({ emit: Boolean(onChange) });
  initIcons(toggleEl);

  return {
    getChecked() {
      return state === "true";
    },
    getState() {
      return state;
    },
    setChecked(checked) {
      setChecked(checked);
    },
    setState(next) {
      setState(next);
    },
    toggle() {
      if (isTristate) {
        advanceTristateCycle("api");
        return;
      }
      setChecked(state !== "true", { source: "api" });
    },
    cycle() {
      if (!isTristate) {
        setChecked(state !== "true", { source: "api" });
        return;
      }
      advanceTristateCycle("api");
    },
    isTristate() {
      return isTristate;
    },
    getTristateCycle() {
      return isTristate ? tristateCycleId : null;
    },
    setDisabled(nextDisabled) {
      applyDisabled(nextDisabled);
    },
    isDisabled() {
      return isDisabled;
    },
  };
}

/** Wire every `.toggle` block in `root`. */
export function initToggles(root = document) {
  const instances = [];
  root.querySelectorAll(".toggle").forEach((toggleEl) => {
    const instance = initToggle(toggleEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
