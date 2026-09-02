/**
 * Block (segment) selection for a single text time field — `HH:MM`, `HH:MM:SS`,
 * or duration `H:MM`. Restores the native `<input type="time">` feel now that
 * the field is a plain text input:
 *
 * - Pressing selects the block under the pointer; keyboard focus selects hours
 * - Arrow Up / Down nudges the selected block (each block wraps on its own)
 * - Arrow Left / Right, `:`, Home / End move between blocks
 *
 * Typing stays native: the selected block is replaced by what you type and the
 * owner re-parses the text on `change` / blur.
 */

import { wrapTimePickerSegment } from "./panel.js";

const SEGMENTS = ["hours", "minutes", "seconds"];

/** @type {CanvasRenderingContext2D | null} */
let measureCtx = null;

/** Rendered width of `text` in the field's font — used to hit-test blocks. */
function textWidth(input, text) {
  measureCtx ||= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return 0;
  const styles = getComputedStyle(input);
  measureCtx.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  return measureCtx.measureText(text).width;
}

/** Character ranges of each `:`-separated block in `value`. */
function segmentRanges(value) {
  const ranges = [];
  let start = 0;
  for (let index = 0; index <= value.length; index += 1) {
    if (index === value.length || value[index] === ":") {
      ranges.push({ start, end: index });
      start = index + 1;
    }
  }
  return ranges;
}

function segmentIndexAt(ranges, caret) {
  const index = ranges.findIndex((range) => caret <= range.end);
  return index >= 0 ? index : Math.max(0, ranges.length - 1);
}

/**
 * @param {HTMLInputElement | null} input
 * @param {{
 *   mode?: "time" | "duration",
 *   maxHours?: number,
 *   showSeconds?: boolean,
 *   getParts: () => { hours: number, minutes: number, seconds?: number },
 *   applyParts: (parts: object, options: { source: string }) => void,
 *   commit?: () => void,
 *   isDisabled?: () => boolean,
 * }} options
 */
export function initTimeFieldSegments(
  input,
  {
    mode = "time",
    maxHours = 99,
    showSeconds = false,
    getParts,
    applyParts,
    commit,
    isDisabled = () => false,
  } = {}
) {
  if (!(input instanceof HTMLInputElement) || !getParts || !applyParts) return null;

  // Set by the pointer path so keyboard focus alone jumps to hours.
  let focusFromPointer = false;

  function selectSegment(index) {
    const ranges = segmentRanges(input.value);
    if (!ranges.length) return;
    const range = ranges[Math.min(Math.max(index, 0), ranges.length - 1)];
    input.setSelectionRange(range.start, range.end);
  }

  function currentIndex() {
    const ranges = segmentRanges(input.value);
    return segmentIndexAt(ranges, input.selectionStart ?? 0);
  }

  /** Block under a pointer position, measured from the rendered text. */
  function indexAtPoint(clientX) {
    const styles = getComputedStyle(input);
    const left =
      input.getBoundingClientRect().left +
      parseFloat(styles.borderLeftWidth) +
      parseFloat(styles.paddingLeft);
    const offset = clientX - left + input.scrollLeft;
    const ranges = segmentRanges(input.value);
    for (let index = 0; index < ranges.length - 1; index += 1) {
      // Everything up to and including the following colon belongs to this block.
      if (offset < textWidth(input, input.value.slice(0, ranges[index].end + 1))) {
        return index;
      }
    }
    return ranges.length - 1;
  }

  function moveSegment(delta) {
    const ranges = segmentRanges(input.value);
    const next = currentIndex() + delta;
    if (next < 0 || next >= ranges.length) return false;
    selectSegment(next);
    return true;
  }

  function nudgeSegment(delta) {
    commit?.();
    const index = currentIndex();
    const segment = SEGMENTS[index];
    if (!segment) return;
    applyParts(
      wrapTimePickerSegment(getParts(), segment, delta, {
        mode,
        maxHours,
        showSeconds,
      }),
      { source: "nudge" }
    );
    selectSegment(index);
  }

  // Select on press rather than on click: letting the browser place a caret
  // first would show an I-beam until the button is released.
  const onPointerDown = (event) => {
    if (isDisabled() || event.button !== 0) return;
    event.preventDefault();
    focusFromPointer = true;
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    selectSegment(indexAtPoint(event.clientX));
    focusFromPointer = false;
  };

  const onFocus = () => {
    if (isDisabled() || focusFromPointer) return;
    selectSegment(0);
  };

  const onBlur = () => {
    focusFromPointer = false;
  };

  const onKeydown = (event) => {
    if (isDisabled() || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSegment(event.key === "ArrowUp" ? 1 : -1);
      return;
    }

    if (event.key === ":") {
      event.preventDefault();
      moveSegment(1);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectSegment(event.key === "Home" ? 0 : SEGMENTS.length);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const forward = event.key === "ArrowRight";
      const ranges = segmentRanges(input.value);
      const range = ranges[currentIndex()];
      const caret = input.selectionStart ?? 0;
      const atEdge =
        input.selectionStart !== input.selectionEnd ||
        (forward ? caret >= range.end : caret <= range.start);
      if (atEdge && moveSegment(forward ? 1 : -1)) {
        event.preventDefault();
      }
    }
  };

  input.addEventListener("pointerdown", onPointerDown);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeydown);

  return {
    selectSegment,
    destroy() {
      input.removeEventListener("pointerdown", onPointerDown);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeydown);
    },
  };
}
