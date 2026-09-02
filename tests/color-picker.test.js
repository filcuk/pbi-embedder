import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PICKER_RGBA,
  normalizeFormat,
  rgbaFromHex,
  rgbaFromHexOrDefault,
} from "../app/components/color-picker/panel.js";

test("normalizeFormat accepts known formats and defaults unknown to hsv", () => {
  assert.equal(normalizeFormat("rgb"), "rgb");
  assert.equal(normalizeFormat("HSL"), "hsl");
  assert.equal(normalizeFormat("nope"), "hsv");
  assert.equal(normalizeFormat(undefined), "hsv");
});

test("rgbaFromHex returns null for invalid or empty input", () => {
  assert.equal(rgbaFromHex("zzzz"), null);
  assert.equal(rgbaFromHex(""), null);
  assert.equal(rgbaFromHex(null), null);
  assert.equal(rgbaFromHex("#GG0000"), null);
});

test("rgbaFromHex parses opaque and alpha hex", () => {
  assert.deepEqual(rgbaFromHex("#0969DA"), {
    r: 9,
    g: 105,
    b: 218,
    a: 1,
  });
  assert.deepEqual(rgbaFromHex("#0969DA80", { alpha: true }), {
    r: 9,
    g: 105,
    b: 218,
    a: 128 / 255,
  });
  assert.deepEqual(rgbaFromHex("#0969DA80", { alpha: false }), {
    r: 9,
    g: 105,
    b: 218,
    a: 1,
  });
});

test("rgbaFromHexOrDefault falls back to brand blue", () => {
  assert.deepEqual(rgbaFromHexOrDefault("zzzz"), {
    ...DEFAULT_PICKER_RGBA,
  });
  assert.deepEqual(rgbaFromHexOrDefault("#ff0000"), {
    r: 255,
    g: 0,
    b: 0,
    a: 1,
  });
});
