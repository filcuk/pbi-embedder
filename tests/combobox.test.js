import test from "node:test";
import assert from "node:assert/strict";
import {
  parseValueList,
  isSafeMultiValue,
} from "../app/components/combobox.js";

test("parseValueList splits comma-separated values and trims", () => {
  assert.deepEqual(parseValueList("nyc, chi, hou"), ["nyc", "chi", "hou"]);
  assert.deepEqual(parseValueList("nyc"), ["nyc"]);
});

test("parseValueList accepts arrays and empty input", () => {
  assert.deepEqual(parseValueList(["nyc", " chi ", ""]), ["nyc", "chi"]);
  assert.deepEqual(parseValueList(""), []);
  assert.deepEqual(parseValueList(null), []);
  assert.deepEqual(parseValueList(undefined), []);
});

test("isSafeMultiValue rejects values that contain commas", () => {
  assert.equal(isSafeMultiValue("nyc"), true);
  assert.equal(isSafeMultiValue("Boston, MA"), false);
  assert.equal(isSafeMultiValue(""), true);
});
