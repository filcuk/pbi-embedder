/**
 * Client-side pagination — switch content pages without reload or URL changes.
 *
 * Markup:
 *   <div class="pagination" data-pagination-default="1">
 *     <div class="pagination-panels">
 *       <div class="pagination-panel" data-pagination-panel="1" role="region" aria-label="Page 1">…</div>
 *       <div class="pagination-panel hidden" data-pagination-panel="2" role="region" aria-label="Page 2" hidden>…</div>
 *     </div>
 *     <nav class="pagination-nav" aria-label="Results pages">
 *       <button type="button" class="btn btn-icon pagination-prev" data-pagination-prev
 *         aria-label="Previous page" disabled
 *         data-icon="chevron-left" data-icon-class="btn-icon-svg"></button>
 *       <ul class="pagination-list">
 *         <li class="pagination-item">
 *           <button type="button" class="pagination-page is-active" data-pagination-page="1"
 *             aria-current="page">1</button>
 *         </li>
 *       </ul>
 *       <button type="button" class="btn btn-icon pagination-next" data-pagination-next
 *         aria-label="Next page"
 *         data-icon="chevron-right" data-icon-class="btn-icon-svg"></button>
 *     </nav>
 *     <input type="hidden" class="pagination-value" value="1" />
 *   </div>
 *
 * Panels pair with page buttons via matching data-pagination-panel / data-pagination-page.
 * Without panels, use onChange to render content yourself.
 *
 * data-pagination-default — initial page (1-based)
 * data-pagination-disabled — disable navigation
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";

function parsePageNumber(value) {
  const page = Number.parseInt(String(value), 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function resolveDefaultPage(paginationEl, pageNumbers, defaultPageOption) {
  if (defaultPageOption !== undefined) {
    const page = parsePageNumber(defaultPageOption);
    if (page && pageNumbers.includes(page)) return page;
  }

  const fromAttr = parsePageNumber(paginationEl?.dataset.paginationDefault);
  if (fromAttr && pageNumbers.includes(fromAttr)) return fromAttr;

  const hiddenInput = paginationEl.querySelector(".pagination-value");
  const fromHidden = parsePageNumber(hiddenInput?.value);
  if (fromHidden && pageNumbers.includes(fromHidden)) return fromHidden;

  const current = paginationEl.querySelector(".pagination-page[aria-current='page']");
  const fromCurrent = parsePageNumber(current?.dataset.paginationPage);
  if (fromCurrent && pageNumbers.includes(fromCurrent)) return fromCurrent;

  return pageNumbers[0] ?? 1;
}

function resolveDisabled(paginationEl, disabledOption, navEl) {
  if (typeof disabledOption === "boolean") return disabledOption;
  if (parseBooleanAttr(paginationEl?.dataset.paginationDisabled)) return true;
  return navEl?.getAttribute("aria-disabled") === "true";
}

export function initPagination(
  paginationEl,
  { defaultPage, disabled, onChange } = {}
) {
  if (!paginationEl) return null;

  const navEl = paginationEl.querySelector(".pagination-nav");
  const prevBtn = paginationEl.querySelector("[data-pagination-prev]");
  const nextBtn = paginationEl.querySelector("[data-pagination-next]");
  const pageButtons = [
    ...paginationEl.querySelectorAll(".pagination-page[data-pagination-page]"),
  ];
  const panels = [...paginationEl.querySelectorAll(".pagination-panel")];
  const hiddenInput = paginationEl.querySelector(".pagination-value");

  if (!navEl || !pageButtons.length) return null;

  const pageNumbers = pageButtons
    .map((button) => parsePageNumber(button.dataset.paginationPage))
    .filter((page) => page !== null)
    .sort((a, b) => a - b);

  if (!pageNumbers.length) return null;

  const panelByPage = new Map();
  panels.forEach((panel, index) => {
    const page =
      parsePageNumber(panel.dataset.paginationPanel) ?? pageNumbers[index] ?? index + 1;
    panelByPage.set(page, panel);
  });

  const minPage = pageNumbers[0];
  const maxPage = pageNumbers[pageNumbers.length - 1];

  let activePage = resolveDefaultPage(paginationEl, pageNumbers, defaultPage);
  let isDisabled = resolveDisabled(paginationEl, disabled, navEl);

  function getPageButton(page) {
    return pageButtons.find(
      (button) => parsePageNumber(button.dataset.paginationPage) === page
    );
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    if (!pageNumbers.includes(activePage)) {
      activePage = minPage;
    }

    pageButtons.forEach((button) => {
      const page = parsePageNumber(button.dataset.paginationPage);
      const selected = page === activePage;
      button.classList.toggle("is-active", selected);
      button.tabIndex = selected ? 0 : -1;

      if (selected) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    if (panels.length) {
      panels.forEach((panel) => {
        const page =
          parsePageNumber(panel.dataset.paginationPanel) ??
          pageNumbers[panels.indexOf(panel)] ??
          panels.indexOf(panel) + 1;
        setHidden(panel, page !== activePage);
      });
    }

    const atMin = activePage <= minPage;
    const atMax = activePage >= maxPage;

    if (prevBtn) {
      prevBtn.disabled = isDisabled || atMin;
    }
    if (nextBtn) {
      nextBtn.disabled = isDisabled || atMax;
    }

    navEl.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    paginationEl.classList.toggle("pagination--disabled", isDisabled);

    pageButtons.forEach((button) => {
      button.disabled = isDisabled;
    });

    if (hiddenInput) {
      hiddenInput.value = String(activePage);
      hiddenInput.disabled = isDisabled;
    }

    if (emit) {
      onChange?.({
        paginationEl,
        page: activePage,
        pageCount: pageNumbers.length,
        panel: panelByPage.get(activePage) ?? null,
        source,
      });
    }
  }

  function goToPage(page, { emit = true, source = "api" } = {}) {
    const nextPage = parsePageNumber(page);
    if (!nextPage || !pageNumbers.includes(nextPage)) return;
    if (isDisabled) return;
    if (nextPage === activePage) {
      syncDom({ emit: false });
      return;
    }

    activePage = nextPage;
    syncDom({ emit, source });
  }

  function applyDisabled(nextDisabled) {
    isDisabled = Boolean(nextDisabled);
    syncDom({ emit: false });
  }

  pageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      goToPage(button.dataset.paginationPage, { source: "click" });
    });
  });

  prevBtn?.addEventListener("click", () => {
    const index = pageNumbers.indexOf(activePage);
    if (index > 0) {
      goToPage(pageNumbers[index - 1], { source: "prev" });
    }
  });

  nextBtn?.addEventListener("click", () => {
    const index = pageNumbers.indexOf(activePage);
    if (index < pageNumbers.length - 1) {
      goToPage(pageNumbers[index + 1], { source: "next" });
    }
  });

  navEl.addEventListener("keydown", (e) => {
    if (isDisabled) return;

    const currentIndex = pageNumbers.indexOf(activePage);
    if (currentIndex === -1) return;

    const focusedButton = document.activeElement;
    const focusedIndex = pageButtons.indexOf(focusedButton);
    if (focusedIndex === -1 && focusedButton !== prevBtn && focusedButton !== nextBtn) {
      return;
    }

    let nextIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = Math.min(currentIndex + 1, pageNumbers.length - 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = Math.max(currentIndex - 1, 0);
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = pageNumbers.length - 1;
    } else {
      return;
    }

    if (nextIndex === currentIndex) return;

    e.preventDefault();
    goToPage(pageNumbers[nextIndex], { source: "keyboard" });
    getPageButton(pageNumbers[nextIndex])?.focus();
  });

  syncDom({ emit: Boolean(onChange) });

  return {
    goToPage(page, options) {
      goToPage(page, { ...options, source: options?.source ?? "api" });
    },
    nextPage(options) {
      const index = pageNumbers.indexOf(activePage);
      if (index < pageNumbers.length - 1) {
        goToPage(pageNumbers[index + 1], { ...options, source: options?.source ?? "api" });
      }
    },
    prevPage(options) {
      const index = pageNumbers.indexOf(activePage);
      if (index > 0) {
        goToPage(pageNumbers[index - 1], { ...options, source: options?.source ?? "api" });
      }
    },
    getPage() {
      return activePage;
    },
    getPageCount() {
      return pageNumbers.length;
    },
    setDisabled(nextDisabled) {
      applyDisabled(nextDisabled);
    },
    isDisabled() {
      return isDisabled;
    },
  };
}

/** Wire every `.pagination` block in `root`. */
export function initPaginations(root = document) {
  const instances = [];
  root.querySelectorAll(".pagination").forEach((paginationEl) => {
    const instance = initPagination(paginationEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
