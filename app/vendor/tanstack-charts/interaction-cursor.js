import { createGuideNodes } from "./guide-nodes-internal.js";
import { createInteractionAxis } from "./interaction-axis-internal.js";
const defaultId = "continuous-cursor";
const classPrefix = "ts-chart__continuous-cursor";
function continuousCursor(options) {
  const id = options.id?.trim() || defaultId;
  if (options.id !== void 0 && !options.id.trim()) {
    throw new TypeError("continuousCursor id cannot be empty");
  }
  return {
    id,
    resolve(context) {
      const input = options.position.value;
      const xAxis = cursorAxis(
        "x",
        context.scales.x,
        [context.chart.x, context.chart.x + context.chart.width],
        input?.x
      );
      const yAxis = cursorAxis(
        "y",
        context.scales.y,
        [context.chart.y, context.chart.y + context.chart.height],
        input?.y
      );
      const position = input ? normalizePosition(input, xAxis, yAxis) : null;
      const guide = resolveGuide(options, context);
      const fallbackKey = `behavior:${id}:fallback`;
      const control = {
        kind: "continuous-cursor",
        key: id,
        id,
        extension: continuousCursorControlExtension,
        fallbackNodeKey: fallbackKey,
        bounds: context.chart,
        width: context.width,
        height: context.height,
        xAxis,
        yAxis,
        position,
        guide,
        change(value, reason) {
          options.position.onChange(clonePosition(value), {
            reason: cloneChange(reason)
          });
        }
      };
      return {
        nodes: [renderFallback(control, fallbackKey)],
        controls: [control]
      };
    }
  };
}
function cursorAxis(axis, scale, extent, current) {
  return createInteractionAxis({
    axis,
    scale,
    extent,
    sample: current ?? scaleSample(scale, axis)
  });
}
function scaleSample(scale, axis) {
  const sample = scale?.domain.find(isContinuousCursorValue);
  if (sample === void 0) {
    throw new TypeError(
      `continuousCursor requires a finite numeric or temporal ${axis} scale domain`
    );
  }
  return cloneValue(sample);
}
function resolveGuide(options, context) {
  const rule = (input) => input === false ? false : {
    style: {
      stroke: input?.stroke ?? context.theme.foreground,
      strokeOpacity: finiteNonNegative(input?.strokeOpacity, 0.48),
      strokeWidth: finiteNonNegative(input?.strokeWidth, 1),
      strokeDasharray: input?.strokeDasharray ?? "4 4",
      lineCap: input?.lineCap
    }
  };
  const marker = options.marker === false ? false : {
    radius: finiteNonNegative(options.marker?.radius, 5),
    style: {
      fill: options.marker?.fill ?? context.theme.background,
      fillOpacity: finiteNonNegative(options.marker?.fillOpacity, 1),
      stroke: options.marker?.stroke ?? context.theme.foreground,
      strokeOpacity: finiteNonNegative(options.marker?.strokeOpacity, 1),
      strokeWidth: finiteNonNegative(options.marker?.strokeWidth, 1.5)
    }
  };
  return {
    xRule: rule(options.xRule),
    yRule: rule(options.yRule),
    marker,
    xLabel: resolveLabel(options.xLabel, context),
    yLabel: resolveLabel(options.yLabel, context)
  };
}
function resolveLabel(input, context) {
  if (input === false || input === void 0) return false;
  return {
    format: input.format ?? defaultFormat,
    side: input.side,
    offset: input.offset,
    paddingX: input.paddingX,
    paddingY: input.paddingY,
    radius: input.radius,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    style: { fill: input.color ?? context.theme.background },
    boxStyle: {
      fill: input.background ?? context.theme.foreground,
      stroke: input.stroke ?? context.theme.background,
      strokeWidth: finiteNonNegative(input.strokeWidth, 1)
    }
  };
}
function renderFallback(control, key) {
  return {
    kind: "group",
    key,
    className: `${classPrefix}-fallback`,
    ariaHidden: true,
    children: control.position ? guideNodes(control, control.position) : []
  };
}
function guideNodes(control, position) {
  const x = control.xAxis.position(position.x);
  const y = control.yAxis.position(position.y);
  return createGuideNodes({
    id: control.id,
    classPrefix,
    chart: control.bounds,
    x,
    y,
    xRule: control.guide.xRule,
    yRule: control.guide.yRule,
    marker: control.guide.marker,
    xLabel: control.guide.xLabel === false ? false : {
      ...control.guide.xLabel,
      text: control.guide.xLabel.format(position.x)
    },
    yLabel: control.guide.yLabel === false ? false : {
      ...control.guide.yLabel,
      text: control.guide.yLabel.format(position.y)
    }
  }).nodes;
}
const continuousCursorControlExtension = {
  id: "continuous-cursor",
  create: createContinuousCursorControl
};
function createContinuousCursorControl({
  container,
  surface
}) {
  const namespace = "http://www.w3.org/2000/svg";
  const root = container.ownerDocument.createElementNS(namespace, "svg");
  const hitTarget = container.ownerDocument.createElementNS(namespace, "rect");
  const layer = container.ownerDocument.createElementNS(namespace, "g");
  root.append(hitTarget, layer);
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "absolute",
    inset: "0",
    zIndex: "1",
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "auto",
    touchAction: "none"
  });
  hitTarget.setAttribute("fill", "transparent");
  hitTarget.setAttribute("pointer-events", "all");
  layer.style.pointerEvents = "none";
  let control;
  let scene;
  let transient = null;
  let pinned = false;
  let awaitingControl = false;
  let lastSource = "pointer";
  root.addEventListener("pointermove", handlePointerMove);
  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointerleave", handlePointerLeave);
  root.addEventListener("pointercancel", handlePointerCancel);
  root.addEventListener("click", handleClick);
  container.addEventListener("keydown", handleKeyDown, true);
  return {
    update(nextControl, nextScene) {
      const previous = control;
      const next = asContinuousCursorControl(nextControl);
      control = next;
      scene = nextScene;
      root.dataset.chartCursor = next.id;
      root.setAttribute("viewBox", `0 0 ${next.width} ${next.height}`);
      root.setAttribute("width", "100%");
      root.setAttribute("height", "100%");
      hitTarget.setAttribute("x", "0");
      hitTarget.setAttribute("y", "0");
      hitTarget.setAttribute("width", String(next.width));
      hitTarget.setAttribute("height", String(next.height));
      if (!root.isConnected || root.parentElement !== container) {
        container.append(root);
      }
      if (awaitingControl) {
        awaitingControl = false;
        transient = clonePosition(next.position);
        pinned = next.position !== null;
      } else if (next.position) {
        transient = clonePosition(next.position);
        pinned = true;
      } else if (previous?.position) {
        transient = null;
        pinned = false;
      } else if (transient) {
        transient = normalizePosition(transient, next.xAxis, next.yAxis);
      }
      paint(transient);
    },
    contains(target) {
      return Boolean(target && root.contains(target));
    },
    destroy() {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerleave", handlePointerLeave);
      root.removeEventListener("pointercancel", handlePointerCancel);
      root.removeEventListener("click", handleClick);
      container.removeEventListener("keydown", handleKeyDown, true);
      root.remove();
      control = void 0;
      scene = void 0;
      transient = null;
      pinned = false;
      awaitingControl = false;
    }
  };
  function handlePointerMove(event) {
    preview(event, "move");
  }
  function handlePointerDown(event) {
    lastSource = pointerSource(event);
    if (isPinned()) return;
    preview(event, "move");
  }
  function preview(event, cause) {
    lastSource = pointerSource(event);
    if (!control || isPinned()) return;
    awaitingControl = false;
    const position = positionFromClient(event.clientX, event.clientY);
    transient = position;
    paint(position);
    emit(position, {
      type: "preview",
      value: clonePosition(position),
      origin: clonePosition(control.position),
      source: lastSource,
      cause
    });
  }
  function handlePointerLeave(event) {
    clearPreview(pointerSource(event), "leave");
  }
  function handlePointerCancel(event) {
    clearPreview(pointerSource(event), "cancel");
  }
  function clearPreview(source, cause) {
    if (!control || isPinned() || transient === null) return;
    transient = null;
    paint(null);
    emit(null, {
      type: "preview",
      value: null,
      origin: clonePosition(control.position),
      source,
      cause
    });
  }
  function handleClick(event) {
    if (!control) return;
    const origin = pinnedPosition();
    if (origin) {
      propose(null, {
        type: "clear",
        value: null,
        origin: clonePosition(origin),
        source: lastSource,
        cause: "toggle"
      });
      return;
    }
    const next = transient ?? positionFromClient(event.clientX, event.clientY);
    if (!next) return;
    propose(next, {
      type: "commit",
      value: clonePosition(next),
      origin: null,
      source: lastSource,
      cause: "pin"
    });
  }
  function handleKeyDown(event) {
    if (event.key !== "Escape" || !control || transient === null) return;
    event.preventDefault();
    event.stopPropagation();
    propose(null, {
      type: "clear",
      value: null,
      origin: clonePosition(pinnedPosition()),
      source: "keyboard",
      cause: "escape"
    });
  }
  function propose(next, reason) {
    if (!control) return;
    const changed = control;
    awaitingControl = true;
    transient = clonePosition(next);
    pinned = next !== null;
    paint(transient);
    changed.change(next, reason);
    awaitingControl = false;
    const accepted = clonePosition(control?.position ?? null);
    transient = accepted;
    pinned = accepted !== null;
    paint(accepted);
  }
  function emit(next, reason) {
    control?.change(next, reason);
  }
  function isPinned() {
    return pinned;
  }
  function pinnedPosition() {
    return isPinned() ? transient : null;
  }
  function positionFromClient(clientX, clientY) {
    if (!control || !scene) return null;
    const point = surface.clientToScene?.(scene, clientX, clientY);
    if (!point || !containsPoint(control.bounds, point.x, point.y)) return null;
    return {
      x: control.xAxis.valueAt(point.x),
      y: control.yAxis.valueAt(point.y)
    };
  }
  function paint(position) {
    if (!control || !position) {
      root.dataset.visible = "false";
      root.dataset.pinned = "false";
      layer.replaceChildren();
      return;
    }
    root.dataset.visible = "true";
    root.dataset.pinned = String(isPinned());
    syncGuideElements(layer, guideNodes(control, position));
  }
}
function asContinuousCursorControl(control) {
  if (!("kind" in control) || control.kind !== "continuous-cursor") {
    throw new TypeError("Expected a continuous cursor control");
  }
  return control;
}
function syncGuideElements(layer, nodes) {
  const retained = /* @__PURE__ */ new Set();
  const current = new Map(
    [...layer.children].flatMap((element) => {
      const key = element.dataset.guideKey;
      return key ? [[key, element]] : [];
    })
  );
  for (const node of nodes) {
    const tag = nodeTag(node);
    if (!tag) continue;
    let element = current.get(node.key);
    if (!element || element.localName !== tag) {
      element = layer.ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        tag
      );
      element.dataset.guideKey = node.key;
    }
    updateGuideElement(element, node);
    layer.append(element);
    retained.add(element);
  }
  for (const element of [...layer.children]) {
    if (!retained.has(element)) element.remove();
  }
}
function nodeTag(node) {
  if (node.kind === "rule") return "line";
  if (node.kind === "dot") return "circle";
  if (node.kind === "rect") return "rect";
  if (node.kind === "label") return "text";
  return null;
}
function updateGuideElement(element, node) {
  element.setAttribute("class", node.className ?? "");
  syncStyle(element, node.style);
  if (node.kind === "rule") {
    setAttribute(element, "x1", node.x1);
    setAttribute(element, "y1", node.y1);
    setAttribute(element, "x2", node.x2);
    setAttribute(element, "y2", node.y2);
  } else if (node.kind === "dot") {
    setAttribute(element, "cx", node.x);
    setAttribute(element, "cy", node.y);
    setAttribute(element, "r", node.radius);
  } else if (node.kind === "rect") {
    setAttribute(element, "x", node.x);
    setAttribute(element, "y", node.y);
    setAttribute(element, "width", node.width);
    setAttribute(element, "height", node.height);
    setAttribute(element, "rx", node.radius);
  } else if (node.kind === "label") {
    setAttribute(element, "x", node.x);
    setAttribute(element, "y", node.y);
    setAttribute(element, "text-anchor", node.anchor);
    setAttribute(element, "dominant-baseline", node.baseline);
    setAttribute(element, "font-size", node.fontSize);
    setAttribute(element, "font-weight", node.fontWeight);
    element.setAttribute("font-family", "inherit");
    element.textContent = node.text;
  }
}
function syncStyle(element, style) {
  setAttribute(element, "fill", style?.fill);
  setAttribute(element, "fill-opacity", style?.fillOpacity);
  setAttribute(element, "stroke", style?.stroke);
  setAttribute(element, "stroke-opacity", style?.strokeOpacity);
  setAttribute(element, "stroke-width", style?.strokeWidth);
  setAttribute(element, "opacity", style?.opacity);
  setAttribute(element, "stroke-linecap", style?.lineCap);
  setAttribute(element, "stroke-linejoin", style?.lineJoin);
  setAttribute(element, "stroke-dasharray", style?.strokeDasharray);
}
function setAttribute(element, name, value) {
  if (value === void 0) element.removeAttribute(name);
  else element.setAttribute(name, String(value));
}
function normalizePosition(position, xAxis, yAxis) {
  return {
    x: xAxis.valueAt(xAxis.position(position.x)),
    y: yAxis.valueAt(yAxis.position(position.y))
  };
}
function containsPoint(bounds, x, y) {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}
function pointerSource(event) {
  return event.pointerType === "touch" ? "touch" : "pointer";
}
function isContinuousCursorValue(value) {
  return value instanceof Date ? Number.isFinite(value.getTime()) : typeof value === "number" && Number.isFinite(value);
}
function clonePosition(position) {
  return position ? { x: cloneValue(position.x), y: cloneValue(position.y) } : null;
}
function cloneChange(change) {
  return {
    ...change,
    value: clonePosition(change.value),
    origin: clonePosition(change.origin)
  };
}
function cloneValue(value) {
  return value instanceof Date ? new Date(value.getTime()) : value;
}
function defaultFormat(value) {
  return value instanceof Date ? value.toLocaleString() : String(value);
}
function finiteNonNegative(value, fallback) {
  return value !== void 0 && Number.isFinite(value) && value >= 0 ? value : fallback;
}
export {
  continuousCursor
};
