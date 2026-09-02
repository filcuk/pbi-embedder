import { resolveCrosshairGuide } from "./crosshair-resolver.js";
import { createMark } from "./mark.js";
import { valueKey } from "./scales.js";
function crosshair(options = {}) {
  return createMark(({ markIndex }) => {
    const id = options.id ?? `crosshair-${markIndex}`;
    return {
      id,
      focusGuideOnly: true,
      channels: {},
      render: ({ chart, surface, scales, theme, layout }) => ({
        nodes: [],
        focusGuides: [
          {
            key: id,
            markId: id,
            chart,
            surface,
            x: resolveAxis(options.x, options, theme.foreground, scales.x),
            y: resolveAxis(options.y, options, theme.foreground, scales.y),
            marker: resolveMarker(options.marker),
            projectX: projector(scales.x),
            projectY: projector(scales.y),
            motion: options.motion,
            measureText: layout.measureText,
            resolve: resolveCrosshairGuide
          }
        ]
      })
    };
  }, options.motion);
}
function resolveAxis(input, shared, fallbackStroke, scale) {
  if (input === false) return void 0;
  const options = typeof input === "object" ? input : void 0;
  return {
    style: resolveRuleStyle(shared, options, fallbackStroke),
    label: resolveLabel(options?.label, fallbackStroke, scale),
    band: resolveBand(options?.band, fallbackStroke, scale)
  };
}
function resolveBand(input, fallbackFill, scale) {
  if (!input) return void 0;
  const options = typeof input === "object" ? input : void 0;
  return {
    bandwidth: finiteNonnegative(scale?.bandwidth, 0),
    inset: finite(options?.inset, 0),
    radius: options?.radius === void 0 ? void 0 : finiteNonnegative(options.radius, 0),
    style: {
      fill: options?.fill ?? fallbackFill,
      fillOpacity: options?.fillOpacity ?? 0.12,
      stroke: options?.stroke,
      strokeOpacity: options?.strokeOpacity,
      strokeWidth: options?.strokeWidth === void 0 ? void 0 : finiteNonnegative(options.strokeWidth, 0),
      opacity: options?.opacity
    }
  };
}
function resolveRuleStyle(shared, axis, fallbackStroke) {
  return {
    stroke: axis?.stroke ?? shared.stroke ?? fallbackStroke,
    strokeOpacity: axis?.strokeOpacity ?? shared.strokeOpacity ?? 0.35,
    strokeWidth: finiteNonnegative(axis?.strokeWidth ?? shared.strokeWidth, 1),
    strokeDasharray: axis?.strokeDasharray ?? shared.strokeDasharray
  };
}
function resolveLabel(input, fallbackFill, scale) {
  if (!input) return void 0;
  const options = typeof input === "object" ? input : void 0;
  return {
    format: options?.format ? (value) => options.format(value) : scale ? (value) => formatScaleValue(scale, value) : void 0,
    offset: finiteNonnegative(options?.offset, 8),
    fontSize: finiteNonnegative(options?.fontSize, 11),
    fontWeight: options?.fontWeight,
    style: {
      fill: options?.fill ?? fallbackFill,
      fillOpacity: options?.fillOpacity,
      stroke: options?.stroke ?? "var(--ts-chart-crosshair-label-halo, Canvas)",
      strokeOpacity: options?.strokeOpacity,
      strokeWidth: finiteNonnegative(options?.strokeWidth, 3),
      opacity: options?.opacity
    }
  };
}
function projector(scale) {
  return scale && scale.type !== "none" ? (value) => {
    const position = (scale.viewport?.map ?? scale.map)(value);
    return Number.isFinite(position) ? position : void 0;
  } : void 0;
}
function formatScaleValue(scale, value) {
  const identity = valueKey(value);
  const tick = scale.ticks.find(
    (candidate) => valueKey(candidate.value) === identity
  );
  if (tick) return tick.label;
  return value instanceof Date ? value.toLocaleDateString() : String(value);
}
function resolveMarker(input) {
  if (!input) return void 0;
  const options = typeof input === "object" ? input : void 0;
  return {
    radius: finiteNonnegative(options?.radius, 4),
    style: {
      fill: options?.fill ?? "var(--ts-chart-crosshair-marker-fill, Canvas)",
      fillOpacity: options?.fillOpacity,
      stroke: options?.stroke,
      strokeOpacity: options?.strokeOpacity,
      strokeWidth: finiteNonnegative(options?.strokeWidth, 2),
      opacity: options?.opacity
    }
  };
}
function finiteNonnegative(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
export {
  crosshair,
  resolveCrosshairGuide
};
