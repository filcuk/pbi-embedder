import { measureSceneLabelBounds } from "./guide-layout.js";
import { valueKey } from "./scales.js";
function resolveCrosshairGuide(context) {
  const { scene, guide, focus, cursor } = context;
  const target = resolveGuideTarget(guide, focus, cursor);
  return target ? resolveFocusGuide(scene, guide, target) : void 0;
}
function resolveGuideTarget(guide, focus, cursor) {
  const local = focus ? {
    x: focus.primary.x,
    y: focus.primary.y,
    xValue: focusGuideValue(focus.primary, "x"),
    yValue: focusGuideValue(focus.primary, "y"),
    xCursorValue: focus.primary.xValue,
    yCursorValue: focus.primary.yValue,
    color: focus.primary.color
  } : void 0;
  if (!cursor) return local;
  if (!local && (cursor.state.anchor === "value" ? !cursorValueBelongsToGuide(cursor, guide) : !cursorPositionBelongsToGuide(cursor, guide))) {
    return void 0;
  }
  const x = resolveGuideCursorAxis(
    "x",
    guide,
    cursor,
    local?.x,
    local?.xValue,
    local?.xCursorValue
  );
  const y = resolveGuideCursorAxis(
    "y",
    guide,
    cursor,
    local?.y,
    local?.yValue,
    local?.yCursorValue
  );
  if (!x && !y) return void 0;
  return {
    x: x?.position,
    y: y?.position,
    xValue: x?.value,
    yValue: y?.value,
    color: local?.color
  };
}
function focusGuideValue(point, axis) {
  const interval = axis === "x" ? point.xInterval : point.yInterval;
  const endpoint = axis === "x" ? point.x2Value : point.y2Value;
  const value = axis === "x" ? point.xValue : point.yValue;
  return interval === "difference" && endpoint !== void 0 ? endpoint : value;
}
function cursorValueBelongsToGuide(cursor, guide) {
  if (cursor.state.anchor !== "value") return false;
  const values = cursor.state.value;
  return ["x", "y"].every((axis) => {
    if (!(cursor.axes === "xy" || cursor.axes === axis)) return true;
    const value = values[axis];
    if (value === void 0) return true;
    const project = axis === "x" ? guide.projectX : guide.projectY;
    const position = project ? project(value) : cursor[axis]?.position;
    return typeof position === "number" && Number.isFinite(position) && guideContainsAxisPosition(guide, axis, position);
  });
}
function resolveGuideCursorAxis(axis, guide, cursor, fallbackPosition, fallbackValue, fallbackCursorValue) {
  const enabled = cursor.axes === "xy" || cursor.axes === axis;
  const presented = cursor[axis];
  if (enabled && cursor.state.anchor === "value") {
    const values = cursor.state.value;
    const value = values[axis];
    if (value !== void 0 && fallbackCursorValue !== void 0 && valueKey(value) === valueKey(fallbackCursorValue) && typeof fallbackPosition === "number" && Number.isFinite(fallbackPosition)) {
      return { position: fallbackPosition, value: fallbackValue };
    }
    const project = axis === "x" ? guide.projectX : guide.projectY;
    const position = value === void 0 ? void 0 : project?.(value);
    if (typeof position === "number" && Number.isFinite(position) && guideContainsAxisPosition(guide, axis, position)) {
      return { position, value };
    }
    if (!project && presented && Number.isFinite(presented.position) && guideContainsAxisPosition(guide, axis, presented.position)) {
      return { position: presented.position, value: presented.value ?? value };
    }
  } else if (enabled && presented) {
    return { position: presented.position, value: presented.value };
  }
  return typeof fallbackPosition === "number" && Number.isFinite(fallbackPosition) ? { position: fallbackPosition, value: fallbackValue } : void 0;
}
function cursorPositionBelongsToGuide(cursor, guide) {
  return ["x", "y"].every((axis) => {
    if (!(cursor.axes === "xy" || cursor.axes === axis)) return true;
    const presented = cursor[axis];
    return !presented || guideContainsAxisPosition(guide, axis, presented.position);
  });
}
function guideContainsAxisPosition(guide, axis, position) {
  const start = axis === "x" ? guide.chart.x : guide.chart.y;
  const length = axis === "x" ? guide.chart.width : guide.chart.height;
  return position >= start && position <= start + length;
}
function resolveFocusGuide(scene, guide, target) {
  const { x, y } = target;
  const plotChildren = [];
  const children = [];
  if (guide.x && typeof x === "number" && Number.isFinite(x)) {
    let labelX = x;
    if (guide.x.band) {
      const center = bandCenter(guide, "x", target.xValue, x);
      labelX = center;
      const width = Math.max(0, guide.x.band.bandwidth - guide.x.band.inset * 2);
      if (width > 0) {
        plotChildren.push({
          kind: "rect",
          key: `${guide.key}:x-band`,
          className: "ts-chart__crosshair-band ts-chart__crosshair-band--x",
          x: center - guide.x.band.bandwidth / 2 + guide.x.band.inset,
          y: guide.chart.y,
          width,
          height: guide.chart.height,
          radius: guide.x.band.radius,
          style: guide.x.band.style
        });
      }
    } else {
      plotChildren.push({
        kind: "rule",
        key: `${guide.key}:x-rule`,
        className: "ts-chart__crosshair-rule ts-chart__crosshair-rule--x",
        x1: x,
        x2: x,
        y1: guide.chart.y,
        y2: guide.chart.y + guide.chart.height,
        style: guide.x.style
      });
    }
    if (guide.x.label && target.xValue !== void 0) {
      children.push(
        ...guideLabels(
          clampLabel(
            {
              kind: "label",
              key: `${guide.key}:x-label`,
              className: "ts-chart__crosshair-label ts-chart__crosshair-label--x",
              x: labelX,
              y: guide.chart.y + guide.chart.height + guide.x.label.offset + guide.x.label.fontSize * 0.8,
              text: formatGuideValue(
                scene,
                "x",
                target.xValue,
                guide.x.label.format
              ),
              anchor: "middle",
              fontSize: guide.x.label.fontSize,
              fontWeight: guide.x.label.fontWeight,
              style: guide.x.label.style
            },
            guide.surface,
            guide
          )
        )
      );
    }
  }
  if (guide.y && typeof y === "number" && Number.isFinite(y)) {
    let labelY = y;
    if (guide.y.band) {
      const center = bandCenter(guide, "y", target.yValue, y);
      labelY = center;
      const height = Math.max(
        0,
        guide.y.band.bandwidth - guide.y.band.inset * 2
      );
      if (height > 0) {
        plotChildren.push({
          kind: "rect",
          key: `${guide.key}:y-band`,
          className: "ts-chart__crosshair-band ts-chart__crosshair-band--y",
          x: guide.chart.x,
          y: center - guide.y.band.bandwidth / 2 + guide.y.band.inset,
          width: guide.chart.width,
          height,
          radius: guide.y.band.radius,
          style: guide.y.band.style
        });
      }
    } else {
      plotChildren.push({
        kind: "rule",
        key: `${guide.key}:y-rule`,
        className: "ts-chart__crosshair-rule ts-chart__crosshair-rule--y",
        x1: guide.chart.x,
        x2: guide.chart.x + guide.chart.width,
        y1: y,
        y2: y,
        style: guide.y.style
      });
    }
    if (guide.y.label && target.yValue !== void 0) {
      children.push(
        ...guideLabels(
          clampLabel(
            {
              kind: "label",
              key: `${guide.key}:y-label`,
              className: "ts-chart__crosshair-label ts-chart__crosshair-label--y",
              x: guide.chart.x - guide.y.label.offset,
              y: labelY,
              text: formatGuideValue(
                scene,
                "y",
                target.yValue,
                guide.y.label.format
              ),
              anchor: "end",
              baseline: "middle",
              fontSize: guide.y.label.fontSize,
              fontWeight: guide.y.label.fontWeight,
              style: guide.y.label.style
            },
            guide.surface,
            guide
          )
        )
      );
    }
  }
  if (guide.marker && typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
    plotChildren.push({
      kind: "dot",
      key: `${guide.key}:marker`,
      className: "ts-chart__crosshair-marker",
      x,
      y,
      radius: guide.marker.radius,
      style: {
        ...guide.marker.style,
        stroke: guide.marker.style.stroke ?? target.color ?? guide.x?.style.stroke ?? guide.y?.style.stroke ?? scene.theme.foreground
      }
    });
  }
  if (plotChildren.length) {
    children.unshift({
      kind: "group",
      key: `${guide.key}:plot`,
      className: "ts-chart__crosshair-plot",
      clip: guide.chart,
      children: plotChildren
    });
  }
  if (!children.length) return void 0;
  return {
    kind: "group",
    key: guide.key,
    className: "ts-chart__crosshair",
    ariaHidden: true,
    children
  };
}
function bandCenter(guide, axis, value, fallback) {
  const project = axis === "x" ? guide.projectX : guide.projectY;
  const position = value === void 0 ? void 0 : project?.(value);
  return typeof position === "number" && Number.isFinite(position) ? position : fallback;
}
function guideLabels(label) {
  const style = label.style ?? {};
  const halo = style.stroke && (style.strokeWidth ?? 0) > 0 && style.strokeOpacity !== 0 ? [
    {
      ...label,
      key: `${label.key}:halo`,
      className: `${label.className ?? ""} ts-chart__crosshair-label-halo`.trim(),
      style: {
        fill: "none",
        stroke: style.stroke,
        strokeOpacity: style.strokeOpacity,
        strokeWidth: style.strokeWidth,
        opacity: style.opacity,
        lineJoin: "round"
      }
    }
  ] : [];
  return [
    ...halo,
    {
      ...label,
      key: `${label.key}:text`,
      className: `${label.className ?? ""} ts-chart__crosshair-label-text`.trim(),
      style: {
        fill: style.fill,
        fillOpacity: style.fillOpacity,
        stroke: "none",
        strokeWidth: 0,
        opacity: style.opacity
      }
    }
  ];
}
function formatGuideValue(scene, axis, value, format) {
  if (format) return format(value);
  const identity = valueKey(value);
  const tick = scene.scales[axis]?.ticks.find(
    (candidate) => valueKey(candidate.value) === identity
  );
  if (tick) return tick.label;
  return value instanceof Date ? value.toLocaleDateString() : String(value);
}
function clampLabel(label, surface, guide) {
  const inset = 2;
  const bounds = measureSceneLabelBounds(label, guide.measureText);
  const left = surface.x + inset;
  const top = surface.y + inset;
  const right = surface.x + surface.width - inset;
  const bottom = surface.y + surface.height - inset;
  const dx = bounds.x < left ? left - bounds.x : bounds.x + bounds.width > right ? right - bounds.x - bounds.width : 0;
  const dy = bounds.y < top ? top - bounds.y : bounds.y + bounds.height > bottom ? bottom - bounds.y - bounds.height : 0;
  return dx || dy ? { ...label, x: label.x + dx, y: label.y + dy } : label;
}
export {
  resolveCrosshairGuide
};
