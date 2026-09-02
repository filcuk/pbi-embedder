import { parseBooleanAttr, setHidden } from "../utils/dom.js";

/**
 * Multi-step progress indicator with a horizontal step list, panels, and back/next actions.
 *
 * Markup:
 *   <div class="progress-indicator" data-progress-indicator-linear data-progress-indicator-default="0">
 *     <ol class="progress-indicator-list">
 *       <li class="progress-indicator-item">
 *         <button type="button" class="progress-indicator-step" id="step-1" aria-current="step">
 *           <span class="progress-indicator-marker" aria-hidden="true">1</span>
 *           <span class="progress-indicator-label">Details</span>
 *         </button>
 *       </li>
 *     </ol>
 *     <div class="progress-indicator-panels">
 *       <div class="progress-indicator-panel" id="panel-1" role="region" aria-labelledby="step-1">
 *         <div class="progress-indicator-body">…</div>
 *       </div>
 *     </div>
 *     <div class="progress-indicator-actions">
 *       <button type="button" class="btn" data-progress-indicator-back hidden>Back</button>
 *       <button type="button" class="btn btn-primary" data-progress-indicator-next>Next</button>
 *     </div>
 *   </div>
 *
 * data-progress-indicator-linear — when set (default), only visited steps are clickable in the header
 * data-progress-indicator-default — initial step index (0-based)
 * data-progress-indicator-finish-label — label for the next button on the last step (default: "Finish")
 * data-progress-indicator-vertical — step list in a left column with vertical connectors
 */

function parseStepIndex(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveLinear(progressIndicatorEl, linearOption) {
  if (typeof linearOption === "boolean") return linearOption;
  if (progressIndicatorEl?.dataset.progressIndicatorLinear === "false") return false;
  return parseBooleanAttr(progressIndicatorEl?.dataset.progressIndicatorLinear) ?? true;
}

function resolveVertical(progressIndicatorEl, verticalOption) {
  if (typeof verticalOption === "boolean") return verticalOption;
  return parseBooleanAttr(progressIndicatorEl?.dataset.progressIndicatorVertical) ?? false;
}

export function initProgressIndicator(
  progressIndicatorEl,
  {
    defaultStep,
    linear,
    vertical,
    finishLabel,
    nextLabel = "Next",
    backLabel = "Back",
    onChange,
    onFinish,
  } = {}
) {
  if (!progressIndicatorEl) return null;

  const stepItems = [
    ...progressIndicatorEl.querySelectorAll(".progress-indicator-list .progress-indicator-item"),
  ];
  const steps = stepItems
    .map((item) => item.querySelector(".progress-indicator-step"))
    .filter(Boolean);
  const panels = [
    ...progressIndicatorEl.querySelectorAll(".progress-indicator-panels .progress-indicator-panel"),
  ];
  const backBtn = progressIndicatorEl.querySelector("[data-progress-indicator-back]");
  const nextBtn = progressIndicatorEl.querySelector("[data-progress-indicator-next]");

  if (!steps.length || steps.length !== panels.length) return null;

  const isLinear = resolveLinear(progressIndicatorEl, linear);
  const isVertical = resolveVertical(progressIndicatorEl, vertical);
  progressIndicatorEl.classList.toggle("progress-indicator--vertical", isVertical);
  const resolvedFinishLabel =
    finishLabel ?? progressIndicatorEl.dataset.progressIndicatorFinishLabel ?? "Finish";
  const initialIndex = Math.min(
    Math.max(
      0,
      defaultStep ?? parseStepIndex(progressIndicatorEl.dataset.progressIndicatorDefault, 0)
    ),
    steps.length - 1
  );

  let activeIndex = initialIndex;
  let maxVisitedIndex = initialIndex;
  let isFinished = false;

  function isLastStep(index = activeIndex) {
    return index >= steps.length - 1;
  }

  function finish({ source = "finish" } = {}) {
    if (!isLastStep() || isFinished) return false;

    isFinished = true;
    syncStepButtons();
    syncActions();

    onFinish?.({
      progressIndicatorEl,
      index: activeIndex,
      step: steps[activeIndex],
      panel: panels[activeIndex],
      source,
    });

    return true;
  }

  function canJumpTo(index) {
    if (index < 0 || index >= steps.length) return false;
    if (!isLinear) return true;
    return index <= maxVisitedIndex;
  }

  function canNavigateTo(index) {
    if (index < 0 || index >= steps.length) return false;
    if (!isLinear) return true;
    if (index <= maxVisitedIndex) return true;
    // Sequential advance (Next button) may open the next unvisited step.
    if (index === activeIndex + 1) return true;
    return false;
  }

  function syncStepButtons() {
    stepItems.forEach((item, index) => {
      const stepBtn = steps[index];
      const isLast = index === steps.length - 1;
      const isComplete =
        index < activeIndex || (isFinished && isLast);
      const isCurrent = index === activeIndex && !(isFinished && isLast);
      const isUpcoming = index > activeIndex && !isComplete;

      item.classList.toggle("is-current", isCurrent);
      item.classList.toggle("is-complete", isComplete);
      item.classList.toggle("is-upcoming", isUpcoming);

      if (isCurrent) {
        stepBtn.setAttribute("aria-current", "step");
      } else {
        stepBtn.removeAttribute("aria-current");
      }

      const jumpable = canJumpTo(index) && index !== activeIndex;
      stepBtn.disabled = !jumpable;
      stepBtn.setAttribute("aria-disabled", jumpable ? "false" : "true");
    });
  }

  function syncPanels() {
    panels.forEach((panel, index) => {
      setHidden(panel, index !== activeIndex);
    });
  }

  function syncActions() {
    if (backBtn) {
      const showBack = activeIndex > 0;
      setHidden(backBtn, !showBack);
      backBtn.disabled = !showBack;
      if (backBtn.textContent !== backLabel) {
        backBtn.textContent = backLabel;
      }
    }

    if (nextBtn) {
      const onLast = isLastStep();
      nextBtn.textContent = onLast ? resolvedFinishLabel : nextLabel;
      nextBtn.disabled = onLast && isFinished;
    }
  }

  function goToStep(index, { emit = true, source = "api" } = {}) {
    if (index < 0 || index >= steps.length) return false;
    if (index === activeIndex) return true;
    if (!canNavigateTo(index)) return false;

    if (index < steps.length - 1) {
      isFinished = false;
    }

    activeIndex = index;
    if (activeIndex > maxVisitedIndex) {
      maxVisitedIndex = activeIndex;
    }

    syncStepButtons();
    syncPanels();
    syncActions();

    const payload = {
      progressIndicatorEl,
      index: activeIndex,
      step: steps[activeIndex],
      stepItem: stepItems[activeIndex],
      panel: panels[activeIndex],
      isLastStep: isLastStep(),
      source,
    };

    if (emit) {
      onChange?.(payload);
    }

    return true;
  }

  function nextStep({ source = "next" } = {}) {
    if (isLastStep()) {
      return finish({ source });
    }
    return goToStep(activeIndex + 1, { source });
  }

  function prevStep({ source = "back" } = {}) {
    if (activeIndex <= 0) return false;
    return goToStep(activeIndex - 1, { source });
  }

  stepItems.forEach((item, index) => {
    const stepBtn = steps[index];
    stepBtn.addEventListener("click", () => {
      if (stepBtn.disabled) return;
      goToStep(index, { source: "step" });
    });
  });

  backBtn?.addEventListener("click", () => {
    prevStep({ source: "back" });
  });

  nextBtn?.addEventListener("click", () => {
    if (isLastStep()) {
      finish({ source: "finish" });
      return;
    }
    nextStep({ source: "next" });
  });

  goToStep(initialIndex, { emit: Boolean(onChange) });

  return {
    goToStep(index) {
      return goToStep(index);
    },
    nextStep() {
      return nextStep();
    },
    prevStep() {
      return prevStep();
    },
    getActiveIndex() {
      return activeIndex;
    },
    getMaxVisitedIndex() {
      return maxVisitedIndex;
    },
    isLinear() {
      return isLinear;
    },
    isVertical() {
      return isVertical;
    },
    isFinished() {
      return isFinished;
    },
  };
}

/** Wire every `.progress-indicator` block in `root`. */
export function initProgressIndicators(root = document) {
  const instances = [];
  root.querySelectorAll(".progress-indicator").forEach((progressIndicatorEl) => {
    const instance = initProgressIndicator(progressIndicatorEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
