import { mountIcon } from "../utils/icons.js";
import { setHidden, setPageInert, trapTabKey } from "../utils/dom.js";
import { onDocumentEscape } from "../utils/document-listeners.js";
import { closeTooltip } from "./tooltip.js";

const EXPAND_LABEL = "Maximise";
const COLLAPSE_LABEL = "Minimise";
const EXPAND_ICON = "fullscreen";
const COLLAPSE_ICON = "fullscreen-exit";

/** @type {HTMLElement | null} */
let overlayEl = null;
/** @type {HTMLElement | null} */
let stageEl = null;
/** @type {ExpandSession | null} */
let activeSession = null;

function onOverlayKeydown(event) {
  if (!activeSession || !overlayEl) return;
  trapTabKey(event, overlayEl);
}

/**
 * @typedef {{
 *   surface: HTMLElement,
 *   placeholder: Comment,
 *   expandBtn: HTMLButtonElement | null,
 *   label: string,
 *   previouslyFocused: Element | null,
 *   scrollX: number,
 *   scrollY: number,
 *   onSurfaceClick: (event: Event) => void,
 * }} ExpandSession
 */

/**
 * Moving the surface in/out of the overlay changes page height and can shift
 * scroll anchoring; restoring focus can also scroll the trigger into view.
 * @param {{ scrollX: number, scrollY: number }} pos
 */
function restoreScrollPos(pos) {
  if (window.scrollX !== pos.scrollX || window.scrollY !== pos.scrollY) {
    window.scrollTo(pos.scrollX, pos.scrollY);
  }
}

function ensureOverlay() {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.id = "expandable-surface-overlay";
  overlayEl.className = "expandable-overlay hidden";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.tabIndex = -1;
  overlayEl.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "expandable-overlay__backdrop";
  backdrop.dataset.expandableSurfaceClose = "";

  stageEl = document.createElement("div");
  stageEl.className = "expandable-overlay__stage";

  overlayEl.append(backdrop, stageEl);
  document.body.appendChild(overlayEl);

  backdrop.addEventListener("click", closeActive);
  overlayEl.addEventListener("keydown", onOverlayKeydown);

  onDocumentEscape(() => {
    if (!activeSession) return false;
    closeActive();
    return true;
  }, { priority: 90 });
}

/**
 * @param {HTMLElement} btn
 * @param {boolean} expanded
 */
function setExpandButtonState(btn, expanded) {
  const label = expanded ? COLLAPSE_LABEL : EXPAND_LABEL;
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  mountIcon(btn, expanded ? COLLAPSE_ICON : EXPAND_ICON, {
    className: "btn-icon-svg expandable-surface__expand-icon",
    replace: true,
  });
}

/**
 * @param {HTMLElement} surface
 * @returns {HTMLElement[]}
 */
function getOpenTriggers(surface) {
  return [...surface.querySelectorAll("[data-expandable-surface-open]")];
}

/**
 * @param {ExpandSession} session
 * @param {boolean} expanded
 */
function syncExpandControls(session, expanded) {
  for (const btn of getOpenTriggers(session.surface)) {
    setExpandButtonState(btn, expanded);
  }
}

/**
 * Whether a code-block should show the floating maximise control.
 * @param {HTMLElement} surface
 */
function codeBlockWantsFloatingMaximize(surface) {
  if (!surface.classList.contains("code-block")) return true;
  const raw = surface.dataset.codeSurfaceActions;
  if (raw === undefined) return true;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "none" || trimmed === "false") return false;
  return trimmed.split(",").some((part) => part.trim() === "maximize");
}

/**
 * Whether to inject the floating maximise control.
 * @param {HTMLElement} surface
 */
function wantsFloatingMaximize(surface) {
  const control = surface.dataset.expandableSurfaceControl?.trim().toLowerCase();
  if (control === "false" || control === "none") return false;
  return codeBlockWantsFloatingMaximize(surface);
}

/**
 * Whether clicks on the surface (not open controls) should toggle expand.
 * @param {HTMLElement} surface
 */
function wantsExpandOnClick(surface) {
  return surface.dataset.expandableSurfaceClick !== undefined;
}

/**
 * @param {Element} target
 * @param {HTMLElement} surface
 */
function isExpandOpenControl(target, surface) {
  const btn = target.closest("[data-expandable-surface-open]");
  return btn instanceof HTMLElement && surface.contains(btn);
}

/**
 * Interactive targets that should not trigger expand-on-click.
 * @param {Element} target
 */
function isInteractiveClickTarget(target) {
  return Boolean(
    target.closest(
      "a, button, input, select, textarea, label, summary, [data-expandable-surface-open]"
    )
  );
}

/**
 * @param {ExpandSession} session
 */
function openSurface(session) {
  ensureOverlay();
  if (!stageEl || !overlayEl) return;

  const { surface, placeholder, label } = session;
  if (!surface.parentNode) return;

  session.scrollX = window.scrollX;
  session.scrollY = window.scrollY;
  session.previouslyFocused = document.activeElement;

  surface.parentNode.insertBefore(placeholder, surface);
  stageEl.appendChild(surface);

  activeSession = session;

  surface.classList.add("is-expanded");
  syncExpandControls(session, true);

  overlayEl.setAttribute("aria-label", label);
  setHidden(overlayEl, false);
  document.body.classList.add("expandable-surface-open");
  setPageInert(true);

  restoreScrollPos(session);
  overlayEl.focus({ preventScroll: true });
  closeTooltip();
}

function closeActive() {
  if (!activeSession || !overlayEl) return;

  const session = activeSession;
  const { surface, placeholder, previouslyFocused } = session;
  const parent = placeholder.parentNode;

  if (parent) {
    parent.insertBefore(surface, placeholder);
    placeholder.remove();
  }

  surface.classList.remove("is-expanded");
  syncExpandControls(session, false);

  setHidden(overlayEl, true);
  document.body.classList.remove("expandable-surface-open");
  setPageInert(false);

  restoreScrollPos(session);
  if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
    previouslyFocused.focus({ preventScroll: true });
  }

  closeTooltip();
  activeSession = null;
}

/**
 * @param {ExpandSession} session
 */
function toggleSession(session) {
  if (activeSession === session) {
    closeActive();
    return;
  }

  if (activeSession) {
    closeActive();
  }

  openSurface(session);
}

/**
 * Add maximise controls; expands the surface into an overlay capped to the
 * page body width (`--page-width`).
 *
 * Markup:
 *   <div class="code-block" data-expandable-surface data-expandable-surface-label="Code sample"
 *     data-code-surface-actions="copy,maximize">
 *     <div class="code-block-body" data-expandable-surface-trigger>…</div>
 *   </div>
 *
 * `data-expandable-surface` — element moved into the overlay when expanded.
 * `data-expandable-surface-trigger` — optional child that hosts the floating button.
 * `data-expandable-surface-label` — accessible name for the overlay dialog.
 * `data-expandable-surface-open` — buttons (toolbar Maximize or floating control) that toggle.
 * `data-expandable-surface-control="false"` — omit the floating maximise button.
 * `data-expandable-surface-click` — click the surface (non-interactive areas) to toggle.
 *
 * For `.code-block`, the floating button is shown only when `maximize` is listed
 * in `data-code-surface-actions` (unless `data-expandable-surface-control="false"`).
 *
 * @param {HTMLElement} surface
 */
export function initExpandableSurface(surface) {
  if (!(surface instanceof HTMLElement)) return null;
  if (surface.dataset.expandableSurfaceInit !== undefined) return null;

  surface.dataset.expandableSurfaceInit = "";
  surface.classList.add("expandable-surface");

  const trigger =
    surface.querySelector("[data-expandable-surface-trigger]") ?? surface;
  const label = surface.dataset.expandableSurfaceLabel ?? "Expanded content";
  const expandOnClick = wantsExpandOnClick(surface);

  trigger.classList.add("expandable-surface-trigger");

  const showFloating = wantsFloatingMaximize(surface);
  /** @type {HTMLButtonElement | null} */
  let expandBtn = null;

  if (showFloating) {
    expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "expandable-surface__expand btn btn-slim btn-icon";
    expandBtn.dataset.tooltipPosition = "top";
    expandBtn.dataset.expandableSurfaceOpen = "";
    setExpandButtonState(expandBtn, false);

    const copyBtn = trigger.querySelector(".code-block-copy");
    let actionsHost = trigger.querySelector(".surface-actions");
    if (copyBtn) {
      if (!actionsHost) {
        actionsHost = document.createElement("div");
        actionsHost.className = "surface-actions";
        copyBtn.parentNode?.insertBefore(actionsHost, copyBtn);
        actionsHost.appendChild(copyBtn);
      }
      actionsHost.prepend(expandBtn);
    } else if (actionsHost) {
      actionsHost.prepend(expandBtn);
    } else {
      trigger.appendChild(expandBtn);
    }
  }

  /** @type {ExpandSession} */
  const session = {
    surface,
    placeholder: document.createComment("expandable-surface-placeholder"),
    expandBtn,
    label,
    previouslyFocused: null,
    scrollX: 0,
    scrollY: 0,
    onSurfaceClick: (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (isExpandOpenControl(target, surface)) {
        event.preventDefault();
        toggleSession(session);
        return;
      }
      if (!expandOnClick || isInteractiveClickTarget(target)) return;
      event.preventDefault();
      toggleSession(session);
    },
  };

  surface.addEventListener("click", session.onSurfaceClick);

  return {
    open() {
      if (activeSession === session) return;
      if (activeSession) closeActive();
      openSurface(session);
    },
    close() {
      if (activeSession === session) closeActive();
    },
    destroy() {
      if (activeSession === session) closeActive();
      surface.removeEventListener("click", session.onSurfaceClick);
      expandBtn?.remove();
      trigger.classList.remove("expandable-surface-trigger");
      surface.classList.remove("expandable-surface");
      delete surface.dataset.expandableSurfaceInit;
    },
  };
}

/** Wire every `[data-expandable-surface]` in `root`. */
export function initExpandableSurfaces(root = document) {
  const instances = [];
  for (const surface of root.querySelectorAll("[data-expandable-surface]")) {
    if (!(surface instanceof HTMLElement)) continue;
    const instance = initExpandableSurface(surface);
    if (instance) instances.push(instance);
  }
  return instances;
}
