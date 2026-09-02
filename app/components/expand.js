import { setHidden } from "../utils/dom.js";

export function initExpand(expandEl, { defaultOpen = false, onToggle } = {}) {
  if (!expandEl) return null;

  const trigger = expandEl.querySelector(".expand-trigger");
  const panel = expandEl.querySelector(".expand-panel");
  if (!trigger || !panel) return null;

  const panelId = panel.id || `expand-panel-${Math.random().toString(36).slice(2, 9)}`;
  if (!panel.id) panel.id = panelId;
  trigger.setAttribute("aria-controls", panelId);

  let isOpen = defaultOpen;

  function setOpen(open) {
    isOpen = open;
    expandEl.classList.toggle("is-open", isOpen);
    setHidden(panel, !isOpen);
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    onToggle?.({ expandEl, isOpen });
  }

  trigger.addEventListener("click", () => {
    setOpen(!isOpen);
  });

  setOpen(defaultOpen);

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen),
    isOpen: () => isOpen,
  };
}

/** Wire every `.expand` block in `root`. */
export function initExpands(root = document) {
  const instances = [];
  root.querySelectorAll(".expand").forEach((expandEl) => {
    const instance = initExpand(expandEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
