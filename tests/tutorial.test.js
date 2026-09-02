import test from "node:test";
import assert from "node:assert/strict";

import { computePopoverPlacement } from "../app/components/popover.js";
import {
  clampTutorialIndex,
  combineTutorialWhen,
  countEligibleTutorialSteps,
  describeTutorialTarget,
  eligibleTutorialOrdinal,
  findEligibleTutorialIndex,
  findShowableTutorialIndex,
  formatTutorialMissingTargetMessage,
  isRectFullyVisible,
  isTutorialStepEligible,
  isTutorialStepShowable,
  nearestShowableTutorialIndex,
  normalizeTutorialSteps,
  tutorialStepHasTargetRef,
} from "../app/components/tutorial.js";

test("isRectFullyVisible ignores already-on-screen targets", () => {
  const viewport = { top: 0, left: 0, bottom: 800, right: 1200 };
  const mid = { top: 200, left: 300, bottom: 280, right: 500 };
  assert.equal(isRectFullyVisible(mid, viewport, 8), true);
});

test("isRectFullyVisible requires padding clearance inside bounds", () => {
  const viewport = { top: 0, left: 0, bottom: 800, right: 1200 };
  const nearTop = { top: 4, left: 100, bottom: 40, right: 200 };
  assert.equal(isRectFullyVisible(nearTop, viewport, 8), false);
  assert.equal(isRectFullyVisible(nearTop, viewport, 0), true);
});

test("isRectFullyVisible detects clipping on any edge", () => {
  const bounds = { top: 50, left: 50, bottom: 250, right: 250 };
  const rect = { top: 60, left: 60, bottom: 100, right: 100 };
  assert.equal(isRectFullyVisible(rect, bounds, 0), true);
  assert.equal(
    isRectFullyVisible({ ...rect, top: 40 }, bounds, 0),
    false,
  );
  assert.equal(
    isRectFullyVisible({ ...rect, bottom: 260 }, bounds, 0),
    false,
  );
  assert.equal(
    isRectFullyVisible({ ...rect, left: 40 }, bounds, 0),
    false,
  );
  assert.equal(
    isRectFullyVisible({ ...rect, right: 260 }, bounds, 0),
    false,
  );
});

test("computePopoverPlacement centres without an anchor and hides the notch", () => {
  const placed = computePopoverPlacement({
    anchorRect: null,
    bubble: { width: 200, height: 100 },
    viewport: { width: 1000, height: 800 },
  });
  assert.equal(placed.side, null);
  assert.equal(placed.notchOffset, 0);
  assert.equal(placed.left, 400);
  assert.equal(placed.top, 350);
  assert.equal(placed.visible, true);
});

test("computePopoverPlacement prefers the requested side when there is room", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: 400, left: 400, width: 40, height: 20 },
    bubble: { width: 200, height: 80 },
    viewport: { width: 1000, height: 800 },
    position: "bottom",
    gap: 12,
    padding: 8,
  });
  assert.equal(placed.side, "bottom");
  assert.equal(placed.top, 432);
  assert.ok(placed.notchOffset > 0);
  assert.equal(placed.visible, true);
});

test("computePopoverPlacement flips when the requested side is too tight", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: 10, left: 400, width: 40, height: 20 },
    bubble: { width: 200, height: 80 },
    viewport: { width: 1000, height: 800 },
    position: "top",
    gap: 12,
    padding: 8,
  });
  assert.equal(placed.side, "bottom");
});

test("computePopoverPlacement clamps into the viewport and keeps the notch inset", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: 100, left: 5, width: 20, height: 20 },
    bubble: { width: 300, height: 100 },
    viewport: { width: 320, height: 400 },
    position: "bottom",
    gap: 8,
    notchSize: 12,
    padding: 8,
  });
  assert.equal(placed.left, 8);
  assert.ok(placed.notchOffset >= 12);
  assert.ok(placed.notchOffset <= 300 - 12);
});

test("computePopoverPlacement hides when the anchor is fully off-screen", () => {
  const above = computePopoverPlacement({
    anchorRect: { top: -80, left: 100, width: 40, height: 20 },
    bubble: { width: 200, height: 80 },
    viewport: { width: 1000, height: 800 },
    position: "bottom",
  });
  assert.equal(above.visible, false);
  assert.equal(above.side, null);

  const below = computePopoverPlacement({
    anchorRect: { top: 900, left: 100, width: 40, height: 20 },
    bubble: { width: 200, height: 80 },
    viewport: { width: 1000, height: 800 },
    position: "top",
  });
  assert.equal(below.visible, false);
});

test("computePopoverPlacement stays visible when the anchor is only partly clipped", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: -10, left: 100, width: 40, height: 30 },
    bubble: { width: 200, height: 80 },
    viewport: { width: 1000, height: 800 },
    position: "bottom",
    gap: 12,
    padding: 8,
  });
  assert.equal(placed.visible, true);
  assert.equal(placed.side, "bottom");
});

test("computePopoverPlacement auto prefers bottom when it fits", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: 300, left: 300, width: 40, height: 20 },
    bubble: { width: 120, height: 60 },
    viewport: { width: 800, height: 600 },
    position: "auto",
    gap: 12,
    padding: 8,
  });
  assert.equal(placed.side, "bottom");
});

test("computePopoverPlacement auto falls back to a side that fits", () => {
  const placed = computePopoverPlacement({
    anchorRect: { top: 10, left: 10, width: 40, height: 20 },
    bubble: { width: 120, height: 200 },
    viewport: { width: 800, height: 240 },
    position: "auto",
    gap: 12,
    padding: 8,
  });
  /* Top/bottom are too tight for a 200px bubble; right still fits. */
  assert.equal(placed.side, "right");
});

test("clampTutorialIndex bounds and rejects empty scripts", () => {
  assert.equal(clampTutorialIndex(0, 0), -1);
  assert.equal(clampTutorialIndex(2, 3), 2);
  assert.equal(clampTutorialIndex(-4, 3), 0);
  assert.equal(clampTutorialIndex(99, 3), 2);
  assert.equal(clampTutorialIndex(1.9, 3), 1);
});

test("normalizeTutorialSteps fills defaults and accepts advanceOn click", () => {
  assert.deepEqual(normalizeTutorialSteps(null), []);
  assert.deepEqual(normalizeTutorialSteps(undefined), []);

  const [step] = normalizeTutorialSteps([
    {
      target: "#save",
      title: "Save",
      body: "Click save",
      interactive: true,
      advanceOn: "click",
      padding: 16,
    },
  ]);

  assert.equal(step.target, "#save");
  assert.equal(step.title, "Save");
  assert.equal(step.body, "Click save");
  assert.equal(step.position, "auto");
  assert.equal(step.interactive, true);
  assert.equal(step.advanceOn, "click");
  assert.equal(step.padding, 16);
  assert.equal(step.scroll, true);
  assert.equal(step.when, undefined);
});

test("describeTutorialTarget labels selectors, functions, and elements", () => {
  assert.equal(describeTutorialTarget("#save-btn"), "#save-btn");
  assert.equal(describeTutorialTarget(() => null), "[function target]");
  assert.equal(describeTutorialTarget(null), "(none)");

  const el = { tagName: "BUTTON", id: "save", getAttribute: () => null };
  assert.equal(describeTutorialTarget(el), "#save");
});

test("formatTutorialMissingTargetMessage describes skip, stop, and disconnect", () => {
  const step = { target: "#missing", title: "Save" };

  assert.match(
    formatTutorialMissingTargetMessage({
      id: "getting-started",
      index: 1,
      step,
      outcome: "skip-forward",
    }),
    /\[tutorial:getting-started\] Missing target for "Save" \(#missing\); skipping forward\./,
  );

  assert.match(
    formatTutorialMissingTargetMessage({
      id: "getting-started",
      index: 1,
      step,
      outcome: "stop",
    }),
    /no reachable step — stopping tour\./,
  );

  assert.match(
    formatTutorialMissingTargetMessage({
      id: "getting-started",
      index: 1,
      step,
      outcome: "disconnected",
    }),
    /is no longer in the document; advancing forward\./,
  );
});

test("normalizeTutorialSteps ignores unknown position and non-click advanceOn", () => {
  const [step] = normalizeTutorialSteps([
    { position: "sideways", advanceOn: "hover", scroll: false },
  ]);
  assert.equal(step.position, "auto");
  assert.equal(step.advanceOn, null);
  assert.equal(step.scroll, false);
  assert.equal(step.interactive, false);
  assert.equal(step.padding, null);
});

test("normalizeTutorialSteps flattens nested groups and ANDs inherited when", () => {
  let parent = true;
  let extra = true;
  const steps = normalizeTutorialSteps([
    { title: "Intro" },
    {
      when: () => parent,
      steps: [
        { title: "B1" },
        { title: "B2", when: () => extra },
      ],
    },
    { when: false, steps: [{ title: "Never" }] },
    { title: "Outro" },
  ]);

  assert.equal(steps.length, 5);
  assert.equal(steps[0].title, "Intro");
  assert.equal(steps[0].when, undefined);
  assert.equal(steps[1].title, "B1");
  assert.equal(typeof steps[1].when, "function");
  assert.equal(steps[2].title, "B2");
  assert.equal(steps[3].title, "Never");
  assert.equal(steps[3].when, false);
  assert.equal(steps[4].title, "Outro");
  assert.equal(isTutorialStepEligible(steps[3], { index: 3, step: steps[3] }), false);

  assert.equal(isTutorialStepEligible(steps[1], { index: 1, step: steps[1] }), true);
  extra = false;
  assert.equal(isTutorialStepEligible(steps[2], { index: 2, step: steps[2] }), false);
  parent = false;
  extra = true;
  assert.equal(isTutorialStepEligible(steps[1], { index: 1, step: steps[1] }), false);
  assert.equal(isTutorialStepEligible(steps[2], { index: 2, step: steps[2] }), false);
});

test("isTutorialStepEligible treats boolean when and thrown when", () => {
  assert.equal(isTutorialStepEligible({ when: true }), true);
  assert.equal(isTutorialStepEligible({ when: false }), false);
  assert.equal(isTutorialStepEligible({ when: () => 0 }), false);
  assert.equal(isTutorialStepEligible({ when: () => "yes" }), true);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnings.push(args);
  };
  try {
    assert.equal(
      isTutorialStepEligible({
        when: () => {
          throw new Error("boom");
        },
      }),
      false,
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
});

test("findEligibleTutorialIndex skips ineligible steps and does not clamp", () => {
  const steps = normalizeTutorialSteps([
    { title: "A" },
    { title: "B", when: false },
    { title: "C", when: () => true },
    { title: "D", when: false },
  ]);

  assert.equal(findEligibleTutorialIndex(steps, 0, "forward"), 0);
  assert.equal(findEligibleTutorialIndex(steps, 1, "forward"), 2);
  assert.equal(findEligibleTutorialIndex(steps, 3, "forward"), -1);
  assert.equal(findEligibleTutorialIndex(steps, 3, "backward"), 2);
  assert.equal(findEligibleTutorialIndex(steps, 0, "backward"), 0);
  assert.equal(findEligibleTutorialIndex(steps, -1, "forward"), -1);
  assert.equal(findEligibleTutorialIndex(steps, 4, "forward"), -1);
});

test("findShowableTutorialIndex skips missing targets as well as when", () => {
  const resolveTarget = (target) =>
    target === "#ok" ? /** @type {HTMLElement} */ ({}) : null;

  const steps = normalizeTutorialSteps([
    { title: "Intro" },
    { title: "Missing", target: "#gone" },
    { title: "Hidden", target: "#ok", when: false },
    { title: "Visible", target: "#ok" },
    { title: "Outro" },
  ]);

  assert.equal(
    findShowableTutorialIndex(steps, 0, "forward", { resolveTarget }),
    0,
  );
  assert.equal(
    findShowableTutorialIndex(steps, 1, "forward", { resolveTarget }),
    3,
  );
  assert.equal(
    findShowableTutorialIndex(steps, 4, "backward", { resolveTarget }),
    4,
  );
  assert.equal(
    findShowableTutorialIndex(steps, 2, "backward", { resolveTarget }),
    0,
  );
  assert.equal(
    findEligibleTutorialIndex(steps, 1, "forward"),
    1,
    "when-only helper still lands on the missing target",
  );
});

test("nearestShowableTutorialIndex prefers the requested index then forward", () => {
  const resolveTarget = (target) =>
    target === "#ok" ? /** @type {HTMLElement} */ ({}) : null;

  const steps = normalizeTutorialSteps([
    { title: "A", target: "#ok" },
    { title: "B", target: "#gone" },
    { title: "C", when: false },
    { title: "D", target: "#ok" },
  ]);

  assert.equal(nearestShowableTutorialIndex(steps, 0, { resolveTarget }), 0);
  assert.equal(nearestShowableTutorialIndex(steps, 1, { resolveTarget }), 0);
  assert.equal(nearestShowableTutorialIndex(steps, 2, { resolveTarget }), 3);
  assert.equal(tutorialStepHasTargetRef(steps[1]), true);
  assert.equal(
    isTutorialStepShowable(steps[1], { index: 1, step: steps[1] }, { resolveTarget }),
    false,
  );
});

test("eligible step counts and ordinals ignore the skipped branch", () => {
  const steps = normalizeTutorialSteps([
    { title: "Intro" },
    { title: "A", when: () => false },
    { title: "B", when: () => true },
    { title: "Outro" },
  ]);

  assert.equal(countEligibleTutorialSteps(steps), 3);
  assert.equal(eligibleTutorialOrdinal(steps, 0), 0);
  assert.equal(eligibleTutorialOrdinal(steps, 1), -1);
  assert.equal(eligibleTutorialOrdinal(steps, 2), 1);
  assert.equal(eligibleTutorialOrdinal(steps, 3), 2);
});

test("showable counts omit missing targets", () => {
  const resolveTarget = (target) =>
    target === "#ok" ? /** @type {HTMLElement} */ ({}) : null;

  const steps = normalizeTutorialSteps([
    { title: "Intro" },
    { title: "Gone", target: "#gone" },
    { title: "Ok", target: "#ok" },
  ]);

  assert.equal(countEligibleTutorialSteps(steps, { resolveTarget }), 2);
  assert.equal(eligibleTutorialOrdinal(steps, 2, { resolveTarget }), 1);
});

test("combineTutorialWhen ANDs parent and child conditions", () => {
  const child = () => true;
  assert.equal(combineTutorialWhen(undefined, child), child);
  assert.equal(combineTutorialWhen(true, child), child);
  assert.equal(combineTutorialWhen(false, child), false);
  assert.equal(combineTutorialWhen(child, undefined), child);

  const combined = combineTutorialWhen(
    () => true,
    () => false,
  );
  assert.equal(typeof combined, "function");
  assert.equal(combined({ index: 0, step: {} }), false);
});

test("navigation helpers model next/back/goTo over a live when path", () => {
  let path = "a";
  const steps = normalizeTutorialSteps([
    { title: "Pick" },
    {
      when: () => path === "b",
      steps: [{ title: "Path B" }],
    },
    {
      when: () => path !== "b",
      steps: [{ title: "Path A" }],
    },
    { title: "Rejoin" },
  ]);

  /* Start → pick (0). */
  assert.equal(nearestShowableTutorialIndex(steps, 0), 0);

  /* Next from pick with default path A → Path A (flattened index 2). */
  assert.equal(findShowableTutorialIndex(steps, 1, "forward"), 2);

  path = "b";
  assert.equal(findShowableTutorialIndex(steps, 1, "forward"), 1);
  assert.equal(findShowableTutorialIndex(steps, 2, "forward"), 3);

  /* Back from rejoin with path B → Path B, not Path A. */
  assert.equal(findShowableTutorialIndex(steps, 2, "backward"), 1);

  /* goTo(2) while path B → nearest showable is Path B (1) or Rejoin (3);
     equal distance from 2 prefers forward → 3. */
  assert.equal(nearestShowableTutorialIndex(steps, 2), 3);

  path = "a";
  assert.equal(countEligibleTutorialSteps(steps), 3);
  assert.equal(eligibleTutorialOrdinal(steps, 2), 1);
});
