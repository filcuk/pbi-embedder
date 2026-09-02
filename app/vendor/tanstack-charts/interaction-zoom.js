import { select } from "d3-selection";
import { zoom as createD3Zoom, zoomIdentity } from "d3-zoom";
import { createInteractionAxis } from "./interaction-axis-internal.js";
import {
  cloneInteractionRange,
  normalizeInteractionRange,
  sameInteractionRange
} from "./interaction-range-internal.js";
const defaultId = "zoom-x";
const defaultAriaLabel = "Zoomable horizontal chart region";
function zoomX(options) {
  const id = options.id?.trim() || defaultId;
  if (options.id !== void 0 && !options.id.trim()) {
    throw new TypeError("zoomX id cannot be empty");
  }
  const scaleExtent = resolveScaleExtent(options.scaleExtent);
  return {
    id,
    resolve(context) {
      assertWindowKinds(options.window.value, options.extent);
      const axis = createInteractionAxis({
        axis: "x",
        scale: context.scales.x,
        extent: [context.chart.x, context.chart.x + context.chart.width],
        sample: options.window.value.start
      });
      const extent = normalizeInteractionRange(axis, {
        start: options.extent[0],
        end: options.extent[1]
      });
      if (sameInteractionValue(axis, extent.start, extent.end)) {
        throw new TypeError("zoomX extent must contain two distinct values");
      }
      const input = normalizeInteractionRange(
        axis,
        options.window.value
      );
      const window = constrainWindow(axis, input, extent, scaleExtent);
      const control = {
        kind: "zoom-x",
        key: id,
        id,
        extension: zoomXControlExtension,
        bounds: context.chart,
        width: context.width,
        height: context.height,
        axis,
        window,
        extent,
        scaleExtent,
        keyboard: options.keyboard !== false,
        ariaLabel: options.ariaLabel ?? defaultAriaLabel,
        ariaDescription: options.ariaDescription,
        format: options.format ?? defaultFormat,
        change(value, reason) {
          options.window.onChange(cloneWindow(value), {
            reason: cloneChange(reason)
          });
        },
        activeChange: options.onActiveChange
      };
      return { controls: [control] };
    }
  };
}
const zoomXControlExtension = {
  id: "zoom-x",
  create: createZoomXControl
};
function createZoomXControl({
  container,
  surface
}) {
  const namespace = "http://www.w3.org/2000/svg";
  const root = container.ownerDocument.createElementNS(namespace, "svg");
  const hitTarget = container.ownerDocument.createElementNS(namespace, "rect");
  root.append(hitTarget);
  Object.assign(root.style, {
    position: "absolute",
    inset: "0",
    zIndex: "1",
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none"
  });
  hitTarget.setAttribute("fill", "transparent");
  hitTarget.setAttribute("pointer-events", "all");
  hitTarget.setAttribute("vector-effect", "non-scaling-stroke");
  hitTarget.style.outline = "none";
  const selection = select(hitTarget);
  const behavior = createD3Zoom().touchable(true).clickDistance(3).filter(filterD3Input).on("start.chart-zoom-x", handleD3Start).on("zoom.chart-zoom-x", handleD3Zoom).on("end.chart-zoom-x", handleD3End);
  let control;
  let scene;
  let active = false;
  let syncing = false;
  let destroying = false;
  let lastAction = "none";
  let wheelCaptured = false;
  let wheelTimer;
  let wheelOrigin;
  let wheelValue;
  let wheelAction;
  let gestureControl;
  let gestureOrigin;
  let gestureValue;
  let gestureAction = "pan";
  let gestureSource = "pointer";
  let gestureActive = false;
  let gestureChanged = false;
  let gestureCancelled = false;
  let cancelEmitted = false;
  let gestureResyncWindow;
  let activeView;
  hitTarget.addEventListener("pointerdown", handlePointerDown);
  hitTarget.addEventListener("pointercancel", handlePointerCancel, true);
  hitTarget.addEventListener("focus", handleFocus);
  hitTarget.addEventListener("blur", handleBlur);
  hitTarget.addEventListener("wheel", observeWheel, { capture: true });
  hitTarget.addEventListener("wheel", handleWheel, { passive: false });
  hitTarget.addEventListener("keydown", handleKeyDown);
  return {
    update(nextControl, nextScene) {
      const next = asZoomXControl(nextControl);
      const gestureDiverged = gestureActive && !gestureCancelled && (Boolean(
        gestureControl && (next.width !== gestureControl.width || next.height !== gestureControl.height)
      ) || (gestureChanged ? !gestureValue || !sameWindow(next.axis, next.window, gestureValue) : Boolean(
        control && !sameWindow(next.axis, next.window, control.window)
      )));
      const abortPointerGesture = gestureDiverged && gestureSource === "pointer";
      const preserveGestureFrame = gestureActive && !gestureCancelled && !gestureDiverged && gestureControl !== void 0;
      const wheelDiverged = Boolean(
        wheelValue && !sameWindow(next.axis, next.window, wheelValue)
      );
      control = next;
      scene = nextScene;
      if (gestureDiverged) abortGesture(next.window);
      else if (gestureResyncWindow) {
        gestureResyncWindow = cloneWindow(next.window);
      }
      if (wheelDiverged) clearWheel();
      root.dataset.chartZoom = next.id;
      root.setAttribute("viewBox", `0 0 ${next.width} ${next.height}`);
      root.setAttribute("width", "100%");
      root.setAttribute("height", "100%");
      hitTarget.dataset.chartZoomSurface = next.id;
      hitTarget.setAttribute("x", String(next.bounds.x));
      hitTarget.setAttribute("y", String(next.bounds.y));
      hitTarget.setAttribute("width", String(next.bounds.width));
      hitTarget.setAttribute("height", String(next.bounds.height));
      hitTarget.setAttribute("aria-label", next.ariaLabel);
      hitTarget.setAttribute(
        "aria-description",
        next.ariaDescription ?? defaultDescription(next)
      );
      if (next.keyboard) {
        hitTarget.setAttribute("role", "application");
        hitTarget.setAttribute("tabindex", "0");
        hitTarget.setAttribute(
          "aria-keyshortcuts",
          "ArrowLeft ArrowRight + - Home Escape"
        );
      } else {
        hitTarget.removeAttribute("role");
        hitTarget.setAttribute("tabindex", "-1");
        hitTarget.removeAttribute("aria-keyshortcuts");
      }
      if (!root.isConnected || root.parentElement !== container) {
        container.append(root);
      }
      configureBehavior(preserveGestureFrame ? gestureControl ?? next : next);
      if (!preserveGestureFrame) syncTransform(next.window);
      if (abortPointerGesture) endMouseGesture();
      updatePresentation();
    },
    contains(target) {
      return Boolean(target && root.contains(target));
    },
    destroy() {
      destroying = true;
      clearWheel();
      if (gestureActive && gestureSource === "pointer") endMouseGesture();
      hitTarget.removeEventListener("pointerdown", handlePointerDown);
      hitTarget.removeEventListener("pointercancel", handlePointerCancel, true);
      hitTarget.removeEventListener("focus", handleFocus);
      hitTarget.removeEventListener("blur", handleBlur);
      hitTarget.removeEventListener("wheel", observeWheel, true);
      hitTarget.removeEventListener("wheel", handleWheel);
      hitTarget.removeEventListener("keydown", handleKeyDown);
      selection.on(".zoom", null);
      if (active) {
        active = false;
        control?.activeChange?.(false);
      }
      root.remove();
      control = void 0;
      scene = void 0;
      gestureActive = false;
      activeView = void 0;
    }
  };
  function filterD3Input(event) {
    if (!active || event.type === "wheel" || event.type === "dblclick") {
      return false;
    }
    return !("button" in event) || Number(event.button) === 0;
  }
  function handlePointerDown() {
    hitTarget.focus();
  }
  function handlePointerCancel() {
    if (gestureActive) cancelGesture(gestureSource);
  }
  function handleFocus() {
    setActive(true);
  }
  function handleBlur() {
    if (gestureActive) cancelGesture(gestureSource);
    else if (wheelTimer) cancelWheel("wheel");
    setActive(false);
  }
  function setActive(next) {
    if (active === next) return;
    active = next;
    updatePresentation();
    control?.activeChange?.(next);
  }
  function observeWheel() {
    wheelCaptured = false;
    updatePresentation();
  }
  function handleWheel(event) {
    if (!active || !control || !scene) return;
    const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    const rawDelta = vertical ? event.deltaY : event.deltaX;
    if (!rawDelta) return;
    const anchor = surface.clientToScene?.(scene, event.clientX, event.clientY);
    if (!anchor || !containsPoint(control.bounds, anchor.x, anchor.y)) return;
    event.preventDefault();
    wheelCaptured = true;
    const action = vertical ? "zoom" : "pan";
    if (wheelAction && wheelAction !== action) commitWheel();
    if (!wheelOrigin || !wheelValue) {
      wheelOrigin = cloneWindow(control.window);
      wheelValue = cloneWindow(control.window);
      wheelAction = action;
    }
    const delta = normalizedWheelDelta(event, vertical ? "y" : "x");
    const next = vertical ? zoomWindow(control, wheelValue, anchor.x, 2 ** (delta / 240)) : panWindow(control, wheelValue, delta / 880 * control.bounds.width);
    lastAction = action;
    updatePresentation();
    if (!sameWindow(control.axis, next, wheelValue)) {
      wheelValue = cloneWindow(next);
      emit(next, {
        type: "preview",
        value: next,
        origin: wheelOrigin,
        source: "wheel",
        action
      });
    }
    if (!wheelOrigin || !wheelValue || !wheelAction) return;
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(commitWheel, 150);
  }
  function commitWheel() {
    if (!wheelOrigin || !wheelValue || !wheelAction) {
      clearWheel();
      return;
    }
    const origin = wheelOrigin;
    const value = wheelValue;
    const action = wheelAction;
    clearWheel();
    emit(value, {
      type: "commit",
      value,
      origin,
      source: "wheel",
      action
    });
  }
  function cancelWheel(source) {
    if (!wheelOrigin || !wheelAction) {
      clearWheel();
      return;
    }
    const origin = wheelOrigin;
    const action = wheelAction;
    clearWheel();
    emit(origin, {
      type: "cancel",
      value: origin,
      origin,
      source,
      action
    });
  }
  function clearWheel() {
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = void 0;
    wheelOrigin = void 0;
    wheelValue = void 0;
    wheelAction = void 0;
  }
  function handleD3Start(event) {
    if (syncing || destroying || !control || !event.sourceEvent) return;
    gestureActive = true;
    gestureChanged = false;
    gestureCancelled = false;
    cancelEmitted = false;
    gestureResyncWindow = void 0;
    gestureControl = control;
    gestureOrigin = cloneWindow(control.window);
    gestureValue = cloneWindow(control.window);
    gestureSource = isTouchEvent(event.sourceEvent) ? "touch" : "pointer";
    gestureAction = touchCount(event.sourceEvent) > 1 ? "zoom" : "pan";
    activeView = eventView(event.sourceEvent);
  }
  function handleD3Zoom(event) {
    if (syncing || destroying || gestureCancelled || !gestureActive || !control || !gestureOrigin) {
      return;
    }
    if (touchCount(event.sourceEvent) > 1) gestureAction = "zoom";
    const frame = gestureControl ?? control;
    const next = windowFromTransform(frame, event.transform);
    if (gestureValue && sameWindow(frame.axis, next, gestureValue)) return;
    gestureValue = cloneWindow(next);
    gestureChanged = true;
    lastAction = gestureAction;
    updatePresentation();
    emit(next, {
      type: "preview",
      value: next,
      origin: gestureOrigin,
      source: gestureSource,
      action: gestureAction
    });
  }
  function handleD3End(event) {
    if (syncing || destroying || !gestureActive || !control) return;
    if (event.sourceEvent?.type === "touchcancel") {
      gestureCancelled = true;
    }
    if (gestureCancelled) {
      if (!cancelEmitted) emitGestureCancel(gestureSource);
      const resyncWindow = gestureResyncWindow ?? gestureOrigin;
      configureBehavior(control);
      if (resyncWindow) syncTransform(resyncWindow);
      resetGesture();
      return;
    }
    if (gestureChanged && gestureOrigin && gestureValue) {
      const origin = gestureOrigin;
      const value = gestureValue;
      const source = gestureSource;
      const action = gestureAction;
      configureBehavior(control);
      syncTransform(control.window);
      resetGesture();
      emit(value, {
        type: "commit",
        value,
        origin,
        source,
        action
      });
      return;
    }
    configureBehavior(control);
    syncTransform(control.window);
    resetGesture();
  }
  function cancelGesture(source) {
    if (!gestureActive || !gestureOrigin || gestureCancelled) return;
    gestureCancelled = true;
    gestureResyncWindow = void 0;
    syncTransform(gestureOrigin);
    emitGestureCancel(source);
    if (gestureSource === "pointer") endMouseGesture();
  }
  function abortGesture(window) {
    gestureCancelled = true;
    cancelEmitted = true;
    gestureValue = void 0;
    gestureResyncWindow = cloneWindow(window);
  }
  function emitGestureCancel(source) {
    if (!gestureOrigin || cancelEmitted) return;
    cancelEmitted = true;
    const origin = gestureOrigin;
    emit(origin, {
      type: "cancel",
      value: origin,
      origin,
      source,
      action: gestureAction
    });
  }
  function endMouseGesture() {
    if (!activeView) return;
    const end = select(activeView).on("mouseup.zoom");
    if (!end) return;
    const event = new activeView.MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true
    });
    Object.defineProperty(event, "view", { value: activeView });
    end.call(activeView, event);
  }
  function resetGesture() {
    gestureControl = void 0;
    gestureOrigin = void 0;
    gestureValue = void 0;
    gestureAction = "pan";
    gestureSource = "pointer";
    gestureActive = false;
    gestureChanged = false;
    gestureCancelled = false;
    cancelEmitted = false;
    gestureResyncWindow = void 0;
    activeView = void 0;
  }
  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (gestureActive) {
        event.preventDefault();
        event.stopPropagation();
        cancelGesture("keyboard");
      } else if (wheelTimer) {
        event.preventDefault();
        event.stopPropagation();
        cancelWheel("keyboard");
      }
      return;
    }
    if (!control?.keyboard) return;
    let next;
    let action;
    if (event.key === "+" || event.key === "=") {
      next = zoomWindow(
        control,
        control.window,
        control.bounds.x + control.bounds.width / 2,
        0.5
      );
      action = "zoom";
    } else if (event.key === "-") {
      next = zoomWindow(
        control,
        control.window,
        control.bounds.x + control.bounds.width / 2,
        2
      );
      action = "zoom";
    } else if (event.key === "ArrowLeft") {
      next = panWindow(control, control.window, -control.bounds.width * 0.125);
      action = "pan";
    } else if (event.key === "ArrowRight") {
      next = panWindow(control, control.window, control.bounds.width * 0.125);
      action = "pan";
    } else if (event.key === "Home") {
      next = cloneWindow(control.extent);
      action = "reset";
    }
    if (!next || !action) return;
    event.preventDefault();
    event.stopPropagation();
    lastAction = action;
    updatePresentation();
    if (sameWindow(control.axis, next, control.window)) return;
    const origin = cloneWindow(control.window);
    emit(next, {
      type: "commit",
      value: next,
      origin,
      source: "keyboard",
      action
    });
  }
  function syncTransform(window) {
    if (!control) return;
    syncing = true;
    selection.call(behavior.transform, transformForWindow(control, window));
    syncing = false;
  }
  function configureBehavior(frame) {
    behavior.extent([
      [frame.bounds.x, frame.bounds.y],
      [
        frame.bounds.x + frame.bounds.width,
        frame.bounds.y + frame.bounds.height
      ]
    ]).translateExtent([
      [frame.bounds.x, frame.bounds.y],
      [
        frame.bounds.x + frame.bounds.width,
        frame.bounds.y + frame.bounds.height
      ]
    ]).scaleExtent([frame.scaleExtent[0], frame.scaleExtent[1]]);
    selection.call(behavior);
    selection.on("dblclick.zoom", null);
  }
  function emit(value, reason) {
    control?.change(value, reason);
  }
  function updatePresentation() {
    hitTarget.dataset.zoomActive = String(active);
    hitTarget.dataset.zoomWheelCaptured = String(wheelCaptured);
    hitTarget.dataset.zoomLastAction = lastAction;
    hitTarget.style.touchAction = active ? "none" : "pan-y";
    hitTarget.setAttribute("stroke", active ? "currentColor" : "transparent");
    hitTarget.setAttribute("stroke-width", "3");
    hitTarget.setAttribute("stroke-dasharray", "6 4");
  }
}
function asZoomXControl(control) {
  if (!("kind" in control) || control.kind !== "zoom-x") {
    throw new TypeError("Expected a horizontal zoom control");
  }
  return control;
}
function windowFromTransform(control, nextTransform) {
  const currentTransform = transformForWindow(control, control.window);
  const left = control.bounds.x;
  const right = left + control.bounds.width;
  return constrainPositions(
    control.axis,
    control.extent,
    control.scaleExtent,
    currentTransform.applyX(nextTransform.invertX(left)),
    currentTransform.applyX(nextTransform.invertX(right))
  );
}
function transformForWindow(control, window) {
  const left = control.bounds.x;
  const right = left + control.bounds.width;
  const extentStart = control.axis.position(control.extent.start);
  const extentEnd = control.axis.position(control.extent.end);
  const baseStart = extentEnd > extentStart ? left : right;
  const fullScale = Math.abs(extentEnd - extentStart) / control.bounds.width;
  const fullTranslate = extentStart - fullScale * baseStart;
  const current = zoomIdentity.translate(fullTranslate, 0).scale(fullScale);
  const windowStart = current.invertX(control.axis.position(window.start));
  const windowEnd = current.invertX(control.axis.position(window.end));
  const outputStart = windowEnd > windowStart ? left : right;
  const outputEnd = windowEnd > windowStart ? right : left;
  const scale = (outputEnd - outputStart) / (windowEnd - windowStart);
  const translate = outputStart - scale * windowStart;
  return zoomIdentity.translate(translate, 0).scale(scale);
}
function zoomWindow(control, window, anchor, factor) {
  const start = control.axis.position(window.start);
  const end = control.axis.position(window.end);
  return constrainPositions(
    control.axis,
    control.extent,
    control.scaleExtent,
    anchor + (start - anchor) * factor,
    anchor + (end - anchor) * factor
  );
}
function panWindow(control, window, delta) {
  return constrainPositions(
    control.axis,
    control.extent,
    control.scaleExtent,
    control.axis.position(window.start) + delta,
    control.axis.position(window.end) + delta
  );
}
function constrainWindow(axis, window, extent, scaleExtent) {
  const constrained = constrainPositions(
    axis,
    extent,
    scaleExtent,
    axis.position(window.start),
    axis.position(window.end)
  );
  return sameMappedWindow(axis, constrained, window) ? cloneWindow(window) : constrained;
}
function constrainPositions(axis, extent, scaleExtent, first, second) {
  const extentStart = axis.position(extent.start);
  const extentEnd = axis.position(extent.end);
  const direction = Math.sign(extentEnd - extentStart);
  const fullSpan = Math.abs(extentEnd - extentStart);
  if (!direction || !Number.isFinite(fullSpan)) {
    throw new TypeError("zoomX extent must map to a finite non-zero span");
  }
  let start = direction * (first - extentStart);
  let end = direction * (second - extentStart);
  if (start > end) [start, end] = [end, start];
  const minimumSpan = Number.isFinite(scaleExtent[1]) ? fullSpan / scaleExtent[1] : 0;
  const maximumSpan = fullSpan / scaleExtent[0];
  let span = Math.max(minimumSpan, Math.min(maximumSpan, end - start));
  if (!Number.isFinite(span) || span <= 0) {
    throw new TypeError("zoomX window must map to a finite non-zero span");
  }
  const center = (start + end) / 2;
  start = center - span / 2;
  end = center + span / 2;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > fullSpan) {
    start -= end - fullSpan;
    end = fullSpan;
  }
  start = Math.max(0, start);
  end = Math.min(fullSpan, end);
  span = end - start;
  if (span <= 0) {
    throw new TypeError("zoomX window must overlap its extent");
  }
  return normalizeInteractionRange(axis, {
    start: axis.invert(extentStart + direction * start),
    end: axis.invert(extentStart + direction * end)
  });
}
function resolveScaleExtent(input) {
  const minimum = input?.[0] ?? 1;
  const maximum = input?.[1] ?? Number.POSITIVE_INFINITY;
  if (minimum !== 1) {
    throw new TypeError("zoomX scaleExtent must start at 1");
  }
  if (!(Number.isFinite(maximum) || maximum === Number.POSITIVE_INFINITY) || maximum < minimum) {
    throw new TypeError(
      "zoomX scaleExtent maximum must be at least 1 or Infinity"
    );
  }
  return [minimum, maximum];
}
function assertWindowKinds(window, extent) {
  const values = [window.start, window.end, extent[0], extent[1]];
  const kind = valueKind(values[0]);
  for (const value of values) {
    if (!validValue(value) || valueKind(value) !== kind) {
      throw new TypeError(
        "zoomX window and extent must use one finite numeric or temporal value type"
      );
    }
  }
}
function validValue(value) {
  return value instanceof Date ? Number.isFinite(value.getTime()) : typeof value === "number" && Number.isFinite(value);
}
function valueKind(value) {
  return value instanceof Date ? "date" : typeof value;
}
function sameInteractionValue(axis, left, right) {
  return axis.layoutKey(left) === axis.layoutKey(right);
}
function sameWindow(axis, left, right) {
  return sameInteractionRange(axis, left, right);
}
function sameMappedWindow(axis, left, right) {
  return Math.abs(axis.position(left.start) - axis.position(right.start)) < 1e-6 && Math.abs(axis.position(left.end) - axis.position(right.end)) < 1e-6;
}
function cloneWindow(window) {
  return cloneInteractionRange(window);
}
function cloneChange(change) {
  return {
    ...change,
    value: cloneWindow(change.value),
    origin: cloneWindow(change.origin)
  };
}
function defaultDescription(control) {
  const pointerInstructions = `${control.format(control.window.start)} to ${control.format(control.window.end)}. Focus before wheel zoom. Drag or use a horizontal wheel to pan.`;
  return control.keyboard ? `${pointerInstructions} Use plus, minus, arrow keys, or Home.` : pointerInstructions;
}
function defaultFormat(value) {
  return value instanceof Date ? value.toLocaleDateString() : String(value);
}
function normalizedWheelDelta(event, axis) {
  const value = axis === "x" ? event.deltaX : event.deltaY;
  if (event.deltaMode === 1) return value * 16;
  if (event.deltaMode === 2) return value * 240;
  return value;
}
function isTouchEvent(event) {
  return Boolean(event && typeof event === "object" && "touches" in event);
}
function touchCount(event) {
  if (!event || typeof event !== "object" || !("touches" in event)) return 0;
  return Number(event.touches?.length ?? 0);
}
function eventView(source) {
  if (!source || typeof source !== "object" || !("view" in source)) return;
  const view = source.view;
  return view && typeof view === "object" && "document" in view ? view : void 0;
}
function containsPoint(bounds, x, y) {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}
export {
  zoomX
};
