import test from "node:test";
import assert from "node:assert/strict";
import {
  getTristateCycleSequence,
  nextTristateCycleStep,
  normalizeTristateCycleId,
  tristateStateAtStep,
  tristateStepForState,
} from "../app/components/toggle.js";

/**
 * @param {import("../app/components/toggle.js").TristateCycleId} cycleId
 * @param {import("../app/components/toggle.js").ToggleState} start
 * @param {import("../app/components/toggle.js").ToggleState[]} expected
 */
function assertCycle(cycleId, start, expected) {
  const cycle = getTristateCycleSequence(cycleId);
  let step = tristateStepForState(start, cycle);
  const states = [tristateStateAtStep(step, cycle)];

  for (let i = 1; i < expected.length; i += 1) {
    step = nextTristateCycleStep(step, cycle);
    states.push(tristateStateAtStep(step, cycle));
  }

  assert.deepEqual(states, expected);
}

test("tri-state default cycle advances off → mixed → on", () => {
  assertCycle("default", "false", ["false", "mixed", "true", "false"]);
});

test("tri-state on-mixed cycle advances off → on → mixed", () => {
  assertCycle("on-mixed", "false", ["false", "true", "mixed", "false"]);
});

test("tri-state mixed-both cycle advances off → mixed → on → mixed", () => {
  assertCycle("mixed-both", "false", ["false", "mixed", "true", "mixed", "false"]);
});

test("mixed-on aliases the default cycle", () => {
  assert.equal(normalizeTristateCycleId("mixed-on"), "default");
  assert.deepEqual(getTristateCycleSequence("mixed-on"), getTristateCycleSequence("default"));
});

test("unknown cycle ids fall back to default", () => {
  assert.deepEqual(getTristateCycleSequence("unknown"), getTristateCycleSequence("default"));
});
