/**
 * Spinner — loading indicator while the interface is not ready for interaction.
 *
 * Inline:
 *   <div class="spinner" role="status" aria-live="polite" aria-busy="true" aria-label="Loading">
 *     <span class="spinner-indicator" aria-hidden="true"></span>
 *     <span class="spinner-label">Loading…</span>
 *   </div>
 *
 * Blocking overlay on a host region:
 *   <div class="spinner-host" id="my-host">
 *     …content…
 *     <div class="spinner-overlay hidden" hidden>
 *       <div class="spinner" role="status" aria-live="polite" aria-busy="true">
 *         <span class="spinner-indicator" aria-hidden="true"></span>
 *         <span class="spinner-label">Loading data…</span>
 *       </div>
 *     </div>
 *   </div>
 *
 * Pass the `.spinner` or `.spinner-host` element to `initSpinner()`.
 *
 * data-spinner-visible — initial visibility ("true" / "false")
 * data-spinner-label — default label text for `.spinner-label`
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";

function resolveVisible(rootEl, visibleOption, overlayEl, spinnerEl) {
  if (typeof visibleOption === "boolean") return visibleOption;

  const fromAttr = parseBooleanAttr(rootEl?.dataset.spinnerVisible);
  if (fromAttr !== undefined) return fromAttr;

  const targetEl = overlayEl ?? spinnerEl;
  return !targetEl?.classList.contains("hidden") && !targetEl?.hasAttribute("hidden");
}

function resolveLabel(rootEl, labelOption, labelEl) {
  if (labelOption !== undefined) return labelOption;
  const fromAttr = rootEl?.dataset.spinnerLabel;
  if (fromAttr !== undefined) return fromAttr;
  return labelEl?.textContent?.trim() ?? "";
}

export function initSpinner(
  rootEl,
  { visible, label, onChange } = {}
) {
  if (!rootEl) return null;

  let hostEl = null;
  let overlayEl = null;
  let spinnerEl = null;
  let targetEl = null;

  if (rootEl.classList.contains("spinner-host")) {
    hostEl = rootEl;
    overlayEl = rootEl.querySelector(".spinner-overlay");
    spinnerEl = overlayEl?.querySelector(".spinner");
    targetEl = overlayEl;
    if (!overlayEl || !spinnerEl) return null;
  } else if (rootEl.classList.contains("spinner")) {
    spinnerEl = rootEl;
    targetEl = spinnerEl;
  } else {
    return null;
  }

  const labelEl = spinnerEl.querySelector(".spinner-label");
  let isVisible = resolveVisible(rootEl, visible, overlayEl, spinnerEl);
  let labelText = resolveLabel(rootEl, label, labelEl);

  function syncDom({ emit = true, source = "init" } = {}) {
    setHidden(targetEl, !isVisible);

    spinnerEl.setAttribute("aria-busy", isVisible ? "true" : "false");

    if (hostEl) {
      hostEl.classList.toggle("spinner-host--busy", isVisible);
      hostEl.setAttribute("aria-busy", isVisible ? "true" : "false");
    }

    if (labelEl) {
      if (labelText) {
        labelEl.textContent = labelText;
        setHidden(labelEl, false);
        spinnerEl.setAttribute("aria-label", labelText);
      } else {
        labelEl.textContent = "";
        setHidden(labelEl, true);
        spinnerEl.setAttribute("aria-label", "Loading");
      }
    } else if (labelText) {
      spinnerEl.setAttribute("aria-label", labelText);
    } else if (!spinnerEl.getAttribute("aria-label")) {
      spinnerEl.setAttribute("aria-label", "Loading");
    }

    if (emit) {
      onChange?.({
        rootEl,
        hostEl,
        spinnerEl,
        visible: isVisible,
        label: labelText,
        source,
      });
    }
  }

  function show({ emit = true, source = "api" } = {}) {
    if (isVisible) {
      syncDom({ emit: false });
      return;
    }
    isVisible = true;
    syncDom({ emit, source });
  }

  function hide({ emit = true, source = "api" } = {}) {
    if (!isVisible) {
      syncDom({ emit: false });
      return;
    }
    isVisible = false;
    syncDom({ emit, source });
  }

  function setLabel(nextLabel, { emit = false } = {}) {
    labelText = String(nextLabel ?? "");
    syncDom({ emit, source: "api" });
  }

  syncDom({ emit: Boolean(onChange) });

  return {
    show() {
      show();
    },
    hide() {
      hide();
    },
    toggle() {
      if (isVisible) hide();
      else show();
    },
    isVisible() {
      return isVisible;
    },
    setLabel(nextLabel) {
      setLabel(nextLabel);
    },
    getLabel() {
      return labelText;
    },
  };
}

/** Wire every `.spinner-host` and standalone `.spinner[data-spinner-visible]` in `root`. */
export function initSpinners(root = document) {
  const instances = [];
  const seen = new Set();

  root.querySelectorAll(".spinner-host").forEach((hostEl) => {
    const instance = initSpinner(hostEl);
    if (instance) {
      instances.push(instance);
      seen.add(hostEl);
    }
  });

  root.querySelectorAll(".spinner").forEach((spinnerEl) => {
    if (spinnerEl.closest(".spinner-overlay")) return;
    if (seen.has(spinnerEl)) return;
    if (!spinnerEl.hasAttribute("data-spinner-visible")) return;
    const instance = initSpinner(spinnerEl);
    if (instance) instances.push(instance);
  });

  return instances;
}
