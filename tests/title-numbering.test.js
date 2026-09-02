import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTitleNumberLabels } from "../app/shell/title-numbering.js";

describe("computeTitleNumberLabels", () => {
  it("numbers a flat h2 outline", () => {
    assert.deepEqual(computeTitleNumberLabels([2, 2, 2]), ["1.", "2.", "3."]);
  });

  it("nests h3 under h2", () => {
    assert.deepEqual(computeTitleNumberLabels([2, 3, 3, 2, 3]), [
      "1.",
      "1.1.",
      "1.2.",
      "2.",
      "2.1.",
    ]);
  });

  it("supports a third level", () => {
    assert.deepEqual(computeTitleNumberLabels([2, 3, 4, 3]), [
      "1.",
      "1.1.",
      "1.1.1.",
      "1.2.",
    ]);
  });

  it("fills skipped levels with zero", () => {
    assert.deepEqual(computeTitleNumberLabels([2, 4]), ["1.", "1.0.1."]);
  });

  it("returns an empty list for no headings", () => {
    assert.deepEqual(computeTitleNumberLabels([]), []);
  });
});
