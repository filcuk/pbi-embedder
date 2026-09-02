import assert from "node:assert/strict";
import test from "node:test";

import { ICONS, ICON_ATTRIBUTIONS } from "../app/utils/icons.js";
import { FRAMEWORK_ICONS } from "../app/utils/icons-framework.js";
import { APP_ICONS } from "../app/utils/icons-app.js";

test("framework ships a non-empty FRAMEWORK_ICONS catalogue", () => {
  assert.ok(Object.keys(FRAMEWORK_ICONS).length >= 20);
  assert.ok(FRAMEWORK_ICONS["light-mode"]?.markup);
  assert.deepEqual(FRAMEWORK_ICONS.lines, { ref: "note" });
});

test("APP_ICONS is empty in the framework itself", () => {
  assert.deepEqual(APP_ICONS, {});
});

test("merged ICONS includes every framework id", () => {
  for (const key of Object.keys(FRAMEWORK_ICONS)) {
    assert.equal(ICONS[key], FRAMEWORK_ICONS[key], key);
  }
});

test("ICON_ATTRIBUTIONS is re-exported from icons.js", () => {
  assert.match(ICON_ATTRIBUTIONS.materialIcons, /Material Icons/);
  assert.match(ICON_ATTRIBUTIONS.materialSymbols, /Material Symbols/);
});
