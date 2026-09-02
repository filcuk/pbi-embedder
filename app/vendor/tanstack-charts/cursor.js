import {} from "./cursor-host-contract.js";
import { valueKey } from "./scales.js";
import {
  chartPointFromNavigationOrder,
  chartPointFromSceneOrder,
  resolveChartFocusStrategy,
  resolveChartPointerFocus,
  restoreChartFocusPoint,
  sameChartPointIdentity
} from "./interaction.js";
function createChartCursor(initialState = null) {
  validateCursorState(initialState);
  let state = initialState;
  const listeners = /* @__PURE__ */ new Set();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState(next) {
      const resolved = typeof next === "function" ? next(state) : next;
      validateCursorState(resolved);
      if (Object.is(resolved, state)) return;
      state = resolved;
      for (const listener of [...listeners]) listener();
    }
  };
}
const cursorHost = {
  id: "cursor",
  __chartExtensionType: "cursor",
  create(controller) {
    let publishedState;
    let publishing = false;
    return {
      controller,
      getState: () => controller.getState(),
      subscribe: (listener) => controller.subscribe(() => {
        if (publishing) {
          publishedState = controller.getState() ?? void 0;
        }
        listener();
      }),
      owns: (state) => state !== null && state === publishedState,
      publish(state) {
        publishedState = state;
        publishing = true;
        try {
          controller.setState(state);
        } finally {
          publishedState = controller.getState() ?? void 0;
          publishing = false;
        }
      },
      clearOwnedTransient() {
        const current = controller.getState();
        if (!current || current !== publishedState || current.pinned) {
          return false;
        }
        publishedState = void 0;
        controller.setState(null);
        return true;
      },
      clear() {
        publishedState = void 0;
        controller.setState(null);
      },
      destroy() {
        const current = controller.getState();
        if (current && current === publishedState && !current.pinned) {
          controller.setState(null);
        }
        publishedState = void 0;
      },
      resolvePresentation: resolveChartCursorPresentation,
      resolveFocus: resolveChartCursorFocus,
      createFocusState: createFocusChartCursorState,
      createFreeState: createFreeChartCursorState
    };
  }
};
function resolveChartCursorPresentation(scene, binding, state) {
  if (!state) return null;
  const match = binding.mode === "focus" ? binding.match ?? "xy" : "xy";
  const x = match === "y" ? void 0 : resolveCursorAxis(scene, binding, state, "x");
  const y = match === "x" ? void 0 : resolveCursorAxis(scene, binding, state, "y");
  return x || y || state.anchor === "value" ? { state, axes: match, x, y } : null;
}
function createFreeChartCursorState(scene, binding, position, source = "pointer", pinned = false) {
  const normalized = {
    x: normalizePosition(position.x, scene.chart.x, scene.chart.width),
    y: normalizePosition(position.y, scene.chart.y, scene.chart.height)
  };
  const base = {
    anchor: "normalized",
    scene: position,
    normalized,
    source,
    pinned
  };
  const presentation = resolveChartCursorPresentation(scene, binding, base);
  const value = cursorValues(presentation?.x?.value, presentation?.y?.value);
  return value ? { ...base, value } : base;
}
function createFocusChartCursorState(scene, binding, focus) {
  const match = binding.match ?? "xy";
  const point = focus.primary;
  if (match === "x") {
    return {
      anchor: "value",
      value: { x: point.xValue },
      scene: { x: point.x },
      normalized: {
        x: normalizePosition(point.x, scene.chart.x, scene.chart.width)
      },
      group: point.group,
      origin: cursorPointIdentity(point),
      source: focus.source,
      pinned: focus.pinned
    };
  }
  if (match === "y") {
    return {
      anchor: "value",
      value: { y: point.yValue },
      scene: { y: point.y },
      normalized: {
        y: normalizePosition(point.y, scene.chart.y, scene.chart.height)
      },
      group: point.group,
      origin: cursorPointIdentity(point),
      source: focus.source,
      pinned: focus.pinned
    };
  }
  return {
    anchor: "value",
    value: { x: point.xValue, y: point.yValue },
    scene: { x: point.x, y: point.y },
    normalized: {
      x: normalizePosition(point.x, scene.chart.x, scene.chart.width),
      y: normalizePosition(point.y, scene.chart.y, scene.chart.height)
    },
    group: point.group,
    origin: cursorPointIdentity(point),
    source: focus.source,
    pinned: focus.pinned
  };
}
function resolveChartCursorFocus(points, binding, state, strategy) {
  if (state?.anchor !== "value") return [];
  const match = binding.match ?? "xy";
  const xValue = state.value.x;
  const yValue = state.value.y;
  if ((match === "x" || match === "xy") && xValue === void 0) return [];
  if ((match === "y" || match === "xy") && yValue === void 0) return [];
  const matches = points.filter(
    (point2) => (match === "y" || sameChartValue(point2.xValue, xValue)) && (match === "x" || sameChartValue(point2.yValue, yValue))
  );
  const groupedMatches = state.group === void 0 ? matches : matches.filter(
    (candidate) => sameChartValue(candidate.group, state.group)
  );
  const candidates = groupedMatches.length ? groupedMatches : matches;
  const origin = state.origin;
  const point = (origin ? cursorPointFromIdentity(candidates, origin) : void 0) ?? candidates[0];
  return point ? strategy?.group(points, { point }) ?? [point] : [];
}
function cursorPointIdentity(point) {
  return {
    key: point.key,
    markId: point.markId,
    datumIndex: point.datumIndex
  };
}
function cursorPointFromIdentity(points, identity) {
  const keyed = points.filter(
    (point) => point.key === identity.key && point.markId === identity.markId
  );
  if (keyed.length === 1) return keyed[0];
  if (keyed.length > 1) {
    return keyed.find((point) => point.datumIndex === identity.datumIndex) ?? keyed[0];
  }
  return void 0;
}
function sameChartValue(left, right) {
  return valueKey(left) === valueKey(right);
}
function resolveCursorAxis(scene, binding, state, axis) {
  const origin = axis === "x" ? scene.chart.x : scene.chart.y;
  const length = axis === "x" ? scene.chart.width : scene.chart.height;
  let position;
  let normalized;
  let value;
  if (state.anchor === "scene") {
    const coordinate = state.scene[axis];
    if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
      return void 0;
    }
    position = coordinate;
    normalized = normalizePosition(position, origin, length);
  } else if (state.anchor === "normalized") {
    const coordinate = state.normalized[axis];
    if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
      return void 0;
    }
    normalized = coordinate;
    position = origin + normalized * length;
  } else {
    value = state.value[axis];
    if (value === void 0) return void 0;
    const scale = scene.scales[axis];
    if (!scale || scale.type === "none") return void 0;
    position = (scale.viewport?.map ?? scale.map)(value);
    if (!Number.isFinite(position)) return void 0;
    normalized = normalizePosition(position, origin, length);
  }
  if (state.anchor !== "value") {
    const options = binding.mode === "free" ? binding[axis] : void 0;
    value = options?.valueAt ? options.valueAt({ axis, scene, position, normalized }) : invertFreeCursorAxis(scene, axis, position);
  }
  return { position, normalized, value };
}
function invertFreeCursorAxis(scene, axis, position) {
  const scale = scene.scales[axis];
  if (!scale || scale.type === "none") {
    throw new TypeError(
      `A free chart cursor requires an ${axis} scale or an explicit ${axis}.valueAt callback`
    );
  }
  if (!scale.invert) {
    throw new TypeError(
      `A free chart cursor requires an invertible ${axis} scale or an explicit ${axis}.valueAt callback`
    );
  }
  const value = scale.invert(position);
  if (typeof value === "number" && !Number.isFinite(value) || value instanceof Date && !Number.isFinite(value.getTime())) {
    throw new TypeError(
      `The free chart cursor ${axis} scale inversion returned an invalid value`
    );
  }
  return value instanceof Date ? new Date(value.getTime()) : value;
}
function cursorValues(x, y) {
  return x !== void 0 ? y !== void 0 ? { x, y } : { x } : y !== void 0 ? { y } : void 0;
}
function normalizePosition(position, origin, length) {
  return (position - origin) / length;
}
function validateCursorState(state) {
  if (!state) return;
  const coordinates = state[state.anchor];
  if (!coordinates || coordinates.x === void 0 && coordinates.y === void 0) {
    throw new TypeError(
      "A chart cursor requires at least one anchor coordinate"
    );
  }
  if (state.anchor !== "value" && (coordinates.x !== void 0 && !Number.isFinite(coordinates.x) || coordinates.y !== void 0 && !Number.isFinite(coordinates.y))) {
    throw new TypeError("Chart cursor coordinates must be finite numbers");
  }
}
export {
  chartPointFromNavigationOrder,
  chartPointFromSceneOrder,
  createChartCursor,
  createFocusChartCursorState,
  createFreeChartCursorState,
  cursorHost,
  resolveChartCursorFocus,
  resolveChartCursorPresentation,
  resolveChartFocusStrategy,
  resolveChartPointerFocus,
  restoreChartFocusPoint,
  sameChartPointIdentity,
  sameChartValue
};
