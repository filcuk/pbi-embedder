import { parseBooleanAttr, setHidden } from "../utils/dom.js";

/**
 * Vertical stack of collapsible sections. One panel open at a time by default.
 *
 * Markup:
 *   <div class="accordion" data-accordion-default-open="0">
 *     <div class="accordion-item">
 *       <h3 class="accordion-heading">
 *         <button type="button" class="accordion-trigger" id="acc-trigger-1"
 *           aria-expanded="false" aria-controls="acc-panel-1">
 *           <span class="accordion-icon" data-icon="chevron-right" data-icon-class="accordion-icon-svg"
 *             aria-hidden="true"></span>
 *           <span class="accordion-label">Section one</span>
 *         </button>
 *       </h3>
 *       <div id="acc-panel-1" class="accordion-panel hidden" role="region"
 *         aria-labelledby="acc-trigger-1" hidden>
 *         <div class="accordion-body">…</div>
 *       </div>
 *     </div>
 *   </div>
 *
 * data-accordion-default-open — index of the panel open on load (optional)
 * data-accordion-multiple — presence or "true" allows more than one open panel
 * data-accordion-open — on an item, open it on load (for multiple mode)
 */

function getItemParts(itemEl) {
  const trigger = itemEl.querySelector(".accordion-trigger");
  const panel = itemEl.querySelector(".accordion-panel");
  if (!trigger || !panel) return null;

  const panelId = panel.id || `accordion-panel-${Math.random().toString(36).slice(2, 9)}`;
  if (!panel.id) panel.id = panelId;

  const triggerId =
    trigger.id || `accordion-trigger-${Math.random().toString(36).slice(2, 9)}`;
  if (!trigger.id) trigger.id = triggerId;

  trigger.setAttribute("aria-controls", panelId);
  panel.setAttribute("aria-labelledby", triggerId);
  if (!panel.getAttribute("role")) panel.setAttribute("role", "region");

  return { trigger, panel };
}

function resolveDefaultOpenIndices(accordionEl, items, allowMultiple) {
  const fromData = accordionEl.dataset.accordionDefaultOpen;
  if (fromData !== undefined && fromData !== "") {
    const index = Number(fromData);
    if (Number.isFinite(index) && index >= 0 && index < items.length) {
      return [index];
    }
  }

  const openIndices = items
    .map((item, index) => (parseBooleanAttr(item.dataset.accordionOpen) ? index : -1))
    .filter((index) => index >= 0);

  if (openIndices.length) {
    return allowMultiple ? openIndices : [openIndices[0]];
  }

  return [];
}

export function initAccordion(
  accordionEl,
  { allowMultiple = false, defaultOpen, onToggle } = {}
) {
  if (!accordionEl) return null;

  const items = [...accordionEl.querySelectorAll(".accordion-item")];
  if (!items.length) return null;

  const itemParts = items
    .map((itemEl) => ({ itemEl, parts: getItemParts(itemEl) }))
    .filter((entry) => entry.parts);

  if (!itemParts.length) return null;

  const canOpenMultiple =
    allowMultiple || parseBooleanAttr(accordionEl.dataset.accordionMultiple);

  const openIndices = new Set();

  function isOpen(index) {
    return openIndices.has(index);
  }

  function setItemOpen(index, open) {
    const entry = itemParts[index];
    if (!entry) return;

    const { itemEl, parts } = entry;
    const { trigger, panel } = parts;

    if (open) {
      if (!canOpenMultiple) {
        openIndices.forEach((openIndex) => {
          if (openIndex !== index) setItemOpen(openIndex, false);
        });
      }
      openIndices.add(index);
    } else {
      openIndices.delete(index);
    }

    const nowOpen = openIndices.has(index);
    itemEl.classList.toggle("is-open", nowOpen);
    setHidden(panel, !nowOpen);
    trigger.setAttribute("aria-expanded", nowOpen ? "true" : "false");
    onToggle?.({ accordionEl, index, itemEl, trigger, panel, isOpen: nowOpen });
  }

  function toggle(index) {
    setItemOpen(index, !isOpen(index));
  }

  itemParts.forEach(({ parts }, index) => {
    parts.trigger.addEventListener("click", () => toggle(index));
  });

  accordionEl.addEventListener("keydown", (event) => {
    const triggers = itemParts.map(({ parts }) => parts.trigger);
    const current = triggers.indexOf(document.activeElement);
    if (current === -1) return;

    let next = current;

    if (event.key === "ArrowDown") next = (current + 1) % triggers.length;
    else if (event.key === "ArrowUp") next = (current - 1 + triggers.length) % triggers.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = triggers.length - 1;
    else return;

    event.preventDefault();
    triggers[next].focus();
  });

  let initialOpen = [];

  if (defaultOpen !== undefined) {
    if (Array.isArray(defaultOpen)) {
      initialOpen = defaultOpen;
    } else if (Number.isFinite(defaultOpen)) {
      initialOpen = [defaultOpen];
    }
  } else {
    initialOpen = resolveDefaultOpenIndices(accordionEl, items, canOpenMultiple);
  }

  if (!canOpenMultiple && initialOpen.length > 1) {
    initialOpen = [initialOpen[0]];
  }

  initialOpen.forEach((index) => setItemOpen(index, true));

  return {
    open: (index) => setItemOpen(index, true),
    close: (index) => setItemOpen(index, false),
    toggle,
    closeAll: () => {
      [...openIndices].forEach((index) => setItemOpen(index, false));
    },
    getOpenIndices: () => [...openIndices],
    isOpen,
  };
}

/** Wire every `.accordion` block in `root`. */
export function initAccordions(root = document) {
  const instances = [];
  root.querySelectorAll(".accordion").forEach((accordionEl) => {
    const instance = initAccordion(accordionEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
