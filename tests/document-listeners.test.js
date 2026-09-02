import test from "node:test";
import assert from "node:assert/strict";
import {
  openPopupGroup,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../app/utils/document-listeners.js";

function popup(name, log) {
  const close = () => {
    log.push(name);
    unregisterOpenPopup(close);
  };
  return close;
}

test("opening a popup closes the previously open one", () => {
  const closed = [];
  const first = popup("first", closed);
  const second = popup("second", closed);

  registerOpenPopup(first);
  registerOpenPopup(second);
  assert.deepEqual(closed, ["first"]);

  unregisterOpenPopup(second);
});

test("popups opened as a group stay open together", () => {
  const closed = [];
  const set = popup("set", closed);
  const picker = popup("picker", closed);
  const other = popup("other", closed);

  openPopupGroup(() => {
    registerOpenPopup(set);
    registerOpenPopup(picker);
  });
  assert.deepEqual(closed, []);

  registerOpenPopup(other);
  assert.deepEqual(closed.sort(), ["picker", "set"]);

  unregisterOpenPopup(other);
});
