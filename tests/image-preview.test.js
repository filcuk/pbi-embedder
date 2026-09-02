import test from "node:test";
import assert from "node:assert/strict";

import { readSvgDimensions } from "../app/components/image-preview.js";

/**
 * @param {{ width?: string, height?: string, viewBox?: [number, number] }} [attrs]
 */
function stubSvg({ width, height, viewBox } = {}) {
  return {
    getAttribute(name) {
      return name === "width" ? (width ?? null) : name === "height" ? (height ?? null) : null;
    },
    viewBox: viewBox
      ? { baseVal: { width: viewBox[0], height: viewBox[1] } }
      : undefined,
  };
}

test("readSvgDimensions prefers explicit SVG dimensions over viewBox", () => {
  assert.deepEqual(
    readSvgDimensions(
      /** @type {SVGSVGElement} */ (
        stubSvg({ width: "640", height: "480", viewBox: [100, 50] })
      )
    ),
    { width: 640, height: 480 }
  );
});

test("readSvgDimensions converts absolute units and preserves aspect ratio", () => {
  assert.deepEqual(
    readSvgDimensions(
      /** @type {SVGSVGElement} */ (
        stubSvg({ width: "2in", viewBox: [100, 50] })
      )
    ),
    { width: 192, height: 96 }
  );
});

test("readSvgDimensions falls back to viewBox when SVG dimensions are omitted", () => {
  assert.deepEqual(
    readSvgDimensions(
      /** @type {SVGSVGElement} */ (stubSvg({ viewBox: [100, 50] }))
    ),
    { width: 100, height: 50 }
  );
});
