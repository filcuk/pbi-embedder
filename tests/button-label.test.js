import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectButtonLabelFlashMeasureLabels } from "../app/utils/button-label.js";

describe("collectButtonLabelFlashMeasureLabels", () => {
  it("returns idle, success, and fail in order", () => {
    assert.deepEqual(
      collectButtonLabelFlashMeasureLabels({
        idle: "Copy",
        success: "Copied",
        fail: "Failed",
      }),
      ["Copy", "Copied", "Failed"]
    );
  });

  it("appends unique measureLabels after the core set", () => {
    assert.deepEqual(
      collectButtonLabelFlashMeasureLabels({
        idle: "Paste",
        success: "Pasted",
        fail: "Failed",
        measureLabels: ["Ctrl+V", "Paste"],
      }),
      ["Paste", "Pasted", "Failed", "Ctrl+V"]
    );
  });

  it("dedupes repeated strings", () => {
    assert.deepEqual(
      collectButtonLabelFlashMeasureLabels({
        idle: "Copy",
        success: "Copied",
        fail: "Copied",
        measureLabels: ["Copy"],
      }),
      ["Copy", "Copied"]
    );
  });
});
