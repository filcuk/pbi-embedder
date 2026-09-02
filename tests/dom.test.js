import test from "node:test";
import assert from "node:assert/strict";
import { parseBooleanAttr } from "../app/utils/dom.js";

test("parseBooleanAttr treats presence and true as true", () => {
  assert.equal(parseBooleanAttr(""), true);
  assert.equal(parseBooleanAttr("true"), true);
  assert.equal(parseBooleanAttr("false"), false);
  assert.equal(parseBooleanAttr(undefined), undefined);
});
