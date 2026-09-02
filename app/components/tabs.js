import { setHidden } from "../utils/dom.js";

function getTabIndex(tabs, tab) {
  return tabs.indexOf(tab);
}

export function initTab(tabsEl, { defaultIndex = 0, onChange } = {}) {
  if (!tabsEl) return null;

  const tablist = tabsEl.querySelector(".tabs-list");
  const tabs = [...tabsEl.querySelectorAll(".tabs-tab[role='tab']")];
  const panels = tabs
    .map((tab) => {
      const panelId = tab.getAttribute("aria-controls");
      return panelId ? document.getElementById(panelId) : null;
    })
    .filter(Boolean);

  if (!tabs.length || tabs.length !== panels.length) return null;

  let activeIndex = defaultIndex;

  function selectTab(index) {
    if (index < 0 || index >= tabs.length) return;

    activeIndex = index;

    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel, i) => {
      setHidden(panel, i !== index);
    });

    onChange?.({
      tabsEl,
      index,
      tab: tabs[index],
      panel: panels[index],
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(index));
  });

  tablist?.addEventListener("keydown", (e) => {
    const current = getTabIndex(tabs, document.activeElement);
    if (current === -1) return;

    let next = current;

    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;

    e.preventDefault();
    selectTab(next);
    tabs[next].focus();
  });

  selectTab(Math.min(defaultIndex, tabs.length - 1));

  return {
    selectTab,
    getActiveIndex: () => activeIndex,
  };
}

/** Wire every `.tabs` block in `root`. */
export function initTabs(root = document) {
  const instances = [];
  root.querySelectorAll(".tabs").forEach((tabsEl) => {
    const instance = initTab(tabsEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
