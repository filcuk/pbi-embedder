import { measureSceneLabelBounds } from "./guide-layout.js";
function createGuideNodes(options) {
  const nodes = [];
  const labels = [];
  if (options.xRule !== false && options.xRule !== void 0) {
    nodes.push({
      kind: "rule",
      key: `${options.id}:x-rule`,
      className: `${options.classPrefix}-x-rule`,
      x1: options.x,
      x2: options.x,
      y1: options.chart.y,
      y2: options.chart.y + options.chart.height,
      style: options.xRule.style
    });
  }
  if (options.yRule !== false && options.yRule !== void 0) {
    nodes.push({
      kind: "rule",
      key: `${options.id}:y-rule`,
      className: `${options.classPrefix}-y-rule`,
      x1: options.chart.x,
      x2: options.chart.x + options.chart.width,
      y1: options.y,
      y2: options.y,
      style: options.yRule.style
    });
  }
  if (options.marker !== false && options.marker !== void 0) {
    nodes.push({
      kind: "dot",
      key: `${options.id}:marker`,
      className: `${options.classPrefix}-marker`,
      x: options.x,
      y: options.y,
      radius: finiteNonNegative(options.marker.radius, 5),
      style: options.marker.style
    });
  }
  if (options.xLabel !== false && options.xLabel !== void 0) {
    const result = createLabel("x", options.xLabel, options);
    nodes.push(...result.nodes);
    labels.push(result.label);
  }
  if (options.yLabel !== false && options.yLabel !== void 0) {
    const result = createLabel("y", options.yLabel, options);
    nodes.push(...result.nodes);
    labels.push(result.label);
  }
  return { nodes, labels };
}
function createLabel(axis, options, context) {
  const side = options.side ?? "end";
  const offset = finiteNonNegative(options.offset, axis === "x" ? 16 : 22);
  const x = axis === "x" ? context.x : side === "start" ? context.chart.x - offset : context.chart.x + context.chart.width + offset;
  const y = axis === "y" ? context.y : side === "start" ? context.chart.y - offset : context.chart.y + context.chart.height + offset;
  const label = {
    kind: "label",
    key: `${context.id}:${axis}-label:text`,
    className: `${context.classPrefix}-${axis}-label-text`,
    x,
    y,
    text: options.text,
    anchor: "middle",
    baseline: "middle",
    fontSize: finiteNonNegative(options.fontSize, 10),
    fontWeight: finiteNonNegative(options.fontWeight, 700),
    style: options.style
  };
  const bounds = measureSceneLabelBounds(label, context.measureText);
  const paddingX = finiteNonNegative(options.paddingX, 5);
  const paddingY = finiteNonNegative(options.paddingY, 4);
  return {
    label,
    nodes: [
      {
        kind: "rect",
        key: `${context.id}:${axis}-label:box`,
        className: `${context.classPrefix}-${axis}-label-box`,
        x: bounds.x - paddingX,
        y: bounds.y - paddingY,
        width: bounds.width + paddingX * 2,
        height: bounds.height + paddingY * 2,
        radius: finiteNonNegative(options.radius, 4),
        style: options.boxStyle
      },
      label
    ]
  };
}
function finiteNonNegative(value, fallback) {
  return value !== void 0 && Number.isFinite(value) && value >= 0 ? value : fallback;
}
export {
  createGuideNodes
};
