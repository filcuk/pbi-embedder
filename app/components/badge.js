/**
 * Badge — corner indicator on a `.badge-host` wrapping a control or label.
 *
 * Variants (class on `.badge`):
 *   (default / normal) — readout with number or text
 *   .badge--sm — round dot only (no visible readout)
 *
 * Markup:
 *   <span class="badge-host" data-badge-label="Notifications">
 *     <button type="button" class="btn" aria-label="Notifications, 3">Notifications</button>
 *     <span class="badge" aria-hidden="true">3</span>
 *   </span>
 *
 *   <span class="badge-host" data-badge-label="Inbox">
 *     <button type="button" class="btn">Inbox</button>
 *     <span class="badge badge--sm" aria-hidden="true"></span>
 *   </span>
 *
 * data-badge-label — accessible name prefix; updates the control’s aria-label
 * data-badge-max — optional; normal badges above this show as "{max}+" (e.g. 99 → "99+")
 */

import { setHidden } from "../utils/dom.js";

function resolveControl(hostEl, badgeEl) {
  const fromAttr = hostEl.querySelector("[data-badge-control]");
  if (fromAttr) return fromAttr;

  for (const child of hostEl.children) {
    if (child === badgeEl) continue;
    if (child.matches("button, a, [role='button'], [role='link']")) return child;
  }
  return null;
}

function isSmallBadge(badgeEl) {
  return badgeEl.classList.contains("badge--sm");
}

function formatBadgeText(value, max) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isFinite(max) && value > max) return `${max}+`;
    return String(Math.trunc(value));
  }
  if (typeof value === "boolean") return value ? "1" : "";
  const text = String(value ?? "").trim();
  return text;
}

function parseInitialValue(badgeEl, isSmall) {
  if (isSmall) {
    return !badgeEl.classList.contains("hidden") && !badgeEl.hasAttribute("hidden");
  }
  const raw = badgeEl?.textContent?.trim() ?? "";
  if (raw === "") return 0;
  const asNumber = Number(raw.replace(/\+$/, ""));
  return Number.isFinite(asNumber) ? asNumber : raw;
}

function isInactiveValue(value) {
  if (value === false || value === null || value === undefined) return true;
  if (typeof value === "number") return value === 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "0";
  }
  return false;
}

export function initBadge(hostEl, { value, max, onChange } = {}) {
  if (!hostEl) return null;

  const badgeEl = hostEl.querySelector(".badge");
  if (!badgeEl) return null;

  const controlEl = resolveControl(hostEl, badgeEl);
  const small = isSmallBadge(badgeEl);
  const labelPrefix =
    hostEl.dataset.badgeLabel?.trim() ||
    controlEl?.dataset.badgeLabel?.trim() ||
    "";

  let maxValue =
    typeof max === "number" && Number.isFinite(max)
      ? max
      : (() => {
          const fromAttr = Number(hostEl.dataset.badgeMax);
          return Number.isFinite(fromAttr) ? fromAttr : null;
        })();

  let currentValue =
    value !== undefined ? value : parseInitialValue(badgeEl, small);

  function syncDom({ emit = true, source = "init" } = {}) {
    const inactive = isInactiveValue(currentValue);
    const display = inactive ? "" : formatBadgeText(currentValue, maxValue);

    if (small) {
      badgeEl.textContent = "";
    } else {
      badgeEl.textContent = display;
    }
    setHidden(badgeEl, inactive);

    if (controlEl && labelPrefix) {
      if (inactive) {
        controlEl.setAttribute("aria-label", labelPrefix);
      } else if (small) {
        const detail =
          typeof currentValue === "number" && Number.isFinite(currentValue)
            ? String(Math.trunc(currentValue))
            : typeof currentValue === "boolean"
              ? "updated"
              : display;
        controlEl.setAttribute("aria-label", `${labelPrefix}, ${detail}`);
      } else {
        controlEl.setAttribute("aria-label", `${labelPrefix}, ${display}`);
      }
    }

    if (emit) {
      onChange?.({
        hostEl,
        badgeEl,
        value: currentValue,
        display: inactive ? "" : small ? "" : display,
        variant: small ? "sm" : "normal",
        source,
      });
    }
  }

  function setValue(nextValue, { emit = true, source = "api" } = {}) {
    if (typeof nextValue === "boolean") {
      currentValue = nextValue;
    } else if (typeof nextValue === "number" && Number.isFinite(nextValue)) {
      currentValue = nextValue;
    } else if (typeof nextValue === "string") {
      const asNumber = Number(nextValue);
      currentValue =
        Number.isFinite(asNumber) && nextValue.trim() !== ""
          ? asNumber
          : nextValue;
    } else {
      currentValue = nextValue ?? 0;
    }
    syncDom({ emit, source });
  }

  syncDom({ emit: Boolean(onChange) });

  return {
    getValue() {
      return currentValue;
    },
    setValue(nextValue) {
      setValue(nextValue);
    },
    increment(by = 1) {
      const amount = Number(by);
      const base =
        typeof currentValue === "number" && Number.isFinite(currentValue)
          ? currentValue
          : Number(currentValue) || 0;
      setValue(base + (Number.isFinite(amount) ? amount : 1), {
        source: "increment",
      });
    },
    clear() {
      setValue(small ? false : 0, { source: "clear" });
    },
  };
}

/** Wire every `.badge-host` that contains a `.badge` in `root`. */
export function initBadges(root = document) {
  const instances = [];
  root.querySelectorAll(".badge-host").forEach((hostEl) => {
    if (!hostEl.querySelector(".badge")) return;
    const instance = initBadge(hostEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
