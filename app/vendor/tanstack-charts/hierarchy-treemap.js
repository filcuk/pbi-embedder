import {
  treemap as createTreemapLayout,
  treemapBinary,
  treemapDice,
  treemapSlice,
  treemapSliceDice,
  treemapSquarify
} from "d3-hierarchy";
import { measureSceneLabelBounds } from "./guide-layout.js";
import {
  aggregateFlatHierarchyValues,
  buildFlatHierarchy,
  flatHierarchyAncestorIds,
  flatHierarchyNodeContext,
  flatHierarchyNodeValue
} from "./hierarchy-flat-internal.js";
import { channelValues, isChartKey, markStates, visualValue } from "./mark.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { valueKey } from "./scales.js";
function treemap(source, options) {
  const hierarchyOptions = options.path !== void 0 ? { path: options.path, delimiter: options.delimiter } : {
    id: options.nodeId,
    parentId: options.parentId
  };
  const hierarchy = buildFlatHierarchy(source, hierarchyOptions, "treemap");
  aggregateFlatHierarchyValues(hierarchy, options.value, "treemap");
  const contexts = /* @__PURE__ */ new WeakMap();
  const context = (node) => {
    const existing = contexts.get(node);
    if (existing) return existing;
    const created = Object.freeze(treemapNodeContext(node));
    contexts.set(node, created);
    return created;
  };
  if (options.sort) {
    hierarchy.root.sort((left, right) => {
      const compared = options.sort(
        context(left),
        context(right)
      );
      if (!Number.isFinite(compared)) {
        throw new TypeError("treemap: sort result must be finite");
      }
      return compared;
    });
  }
  const method = options.method ?? "squarify";
  const ratio = options.ratio ?? (1 + Math.sqrt(5)) / 2;
  assertMethod(method);
  if (options.ratio !== void 0 && method !== "squarify") {
    throw new TypeError('treemap: ratio is only valid with method "squarify"');
  }
  if (!Number.isFinite(ratio) || ratio < 1) {
    throw new TypeError("treemap: ratio must be finite and at least 1");
  }
  const paddingInner = options.paddingInner ?? 0;
  const paddingOuter = options.paddingOuter ?? 0;
  assertNonnegativeFinite(paddingInner, "paddingInner");
  assertNonnegativeFinite(paddingOuter, "paddingOuter");
  const inset = options.inset ?? 0.75;
  const labelPadding = options.labelPadding ?? 4;
  assertNonnegativeFinite(inset, "inset");
  assertNonnegativeFinite(labelPadding, "labelPadding");
  return createMarkWithScaleValues(({ markIndex }) => {
    const id = options.id ?? `treemap-${markIndex}`;
    return {
      id,
      channels: {},
      seriesFromColor: options.color !== void 0,
      resolveLayout: ({ chart, layout }) => {
        const root = hierarchy.root.copy();
        const laidOut = configureLayout(
          createTreemapLayout(),
          chart.width,
          chart.height,
          method,
          ratio,
          options.round ?? false,
          paddingInner,
          paddingOuter
        )(root);
        const leaves = laidOut.leaves();
        assertLayoutCoordinates(leaves, chart.width, chart.height);
        const cells = leaves.map((node) => materializeCell(node, chart.x, chart.y)).filter((cell) => cell.x1 > cell.x0 && cell.y1 > cell.y0);
        const nodes = cells.map((cell) => cell.node);
        const colorValues = channelValues(nodes, options.color, () => null);
        const labels = materializeLabels(
          cells,
          options.label,
          options.labelFontSize ?? 11,
          options.labelFontWeight,
          inset,
          labelPadding,
          layout.measureText,
          id
        );
        return {
          channels: {
            color: {
              scale: "color",
              values: colorValues.filter(isChartKey)
            }
          },
          states: markStates(nodes, options.states),
          render: ({ color: resolveColor, theme }) => {
            const points = [];
            const children = [];
            cells.forEach((cell, nodeIndex) => {
              const node = cell.node;
              const colorValue = colorValues[nodeIndex];
              const fallback = resolveColor(
                isChartKey(colorValue) ? colorValue : null
              );
              const fill = visualValue(
                options.fill,
                node,
                nodeIndex,
                nodes,
                fallback
              );
              const key = `${id}:node:${valueKey(node.id)}`;
              const group = isChartKey(colorValue) ? colorValue : null;
              const point = {
                key,
                markId: id,
                group,
                groupLabel: group === null ? id : String(group),
                datum: node,
                datumIndex: nodeIndex,
                xValue: node.id,
                yValue: node.value,
                x: cell.x,
                y: cell.y,
                color: fill
              };
              points.push(point);
              children.push({
                kind: "rect",
                key,
                x: cell.x0 + inset,
                y: cell.y0 + inset,
                width: Math.max(0, cell.x1 - cell.x0 - inset * 2),
                height: Math.max(0, cell.y1 - cell.y0 - inset * 2),
                radius: options.radius,
                inset,
                insetAxis: "xy",
                interaction: { point },
                style: {
                  fill,
                  fillOpacity: options.fillOpacity,
                  stroke: options.stroke === void 0 ? void 0 : visualValue(
                    options.stroke,
                    node,
                    nodeIndex,
                    nodes,
                    fallback
                  ),
                  strokeOpacity: options.strokeOpacity,
                  strokeWidth: options.strokeWidth
                }
              });
              const label = labels.get(node.id);
              if (label) {
                children.push({
                  ...label,
                  key: `${key}:label`,
                  pointOwner: point,
                  style: {
                    fill: visualValue(
                      options.labelFill,
                      node,
                      nodeIndex,
                      nodes,
                      theme.foreground
                    )
                  }
                });
              }
            });
            return {
              nodes: [
                {
                  kind: "group",
                  key: id,
                  className: "ts-chart__treemap ts-chart__rect ts-chart__text",
                  ariaHidden: true,
                  children
                }
              ],
              points
            };
          }
        };
      }
    };
  }, options.motion);
}
function configureLayout(layout, width, height, method, ratio, round, paddingInner, paddingOuter) {
  const tile = typeof method === "function" ? method : method === "squarify" ? treemapSquarify.ratio(ratio) : method === "binary" ? treemapBinary : method === "dice" ? treemapDice : method === "slice" ? treemapSlice : treemapSliceDice;
  return layout.size([width, height]).tile(tile).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter);
}
function treemapNodeContext(node) {
  return {
    ...flatHierarchyNodeContext(node),
    ancestorIds: flatHierarchyAncestorIds(node),
    value: flatHierarchyNodeValue(node)
  };
}
function materializeCell(node, offsetX, offsetY) {
  const x0 = offsetX + node.x0;
  const y0 = offsetY + node.y0;
  const x1 = offsetX + node.x1;
  const y1 = offsetY + node.y1;
  return {
    node: treemapNodeContext(node),
    x0,
    y0,
    x1,
    y1,
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2
  };
}
function assertLayoutCoordinates(nodes, width, height) {
  nodes.forEach((node) => {
    const coordinates = [node.x0, node.y0, node.x1, node.y1];
    if (!coordinates.every(Number.isFinite)) {
      throw new TypeError(
        `treemap: layout produced non-finite coordinates for node "${node.data.id}"`
      );
    }
    if (node.x1 < node.x0 || node.y1 < node.y0) {
      throw new TypeError(
        `treemap: layout produced reversed coordinates for node "${node.data.id}"`
      );
    }
    if (node.x0 < 0 || node.y0 < 0 || node.x1 > width || node.y1 > height) {
      throw new TypeError(
        `treemap: layout produced out-of-bounds coordinates for node "${node.data.id}"`
      );
    }
  });
}
function materializeLabels(cells, channel, fontSize, fontWeight, inset, padding, measureText, id) {
  if (channel === void 0) return /* @__PURE__ */ new Map();
  const nodes = cells.map((cell) => cell.node);
  const values = channelValues(nodes, channel, () => null);
  const labels = /* @__PURE__ */ new Map();
  cells.forEach((cell, index) => {
    const node = cell.node;
    const value = values[index];
    if (value == null || String(value).length === 0) return;
    const label = {
      kind: "label",
      key: `${id}:label:${valueKey(node.id)}`,
      x: cell.x,
      y: cell.y,
      text: String(value),
      anchor: "middle",
      baseline: "middle",
      fontSize,
      fontWeight
    };
    const bounds = measureSceneLabelBounds(label, measureText);
    const left = cell.x0 + inset + padding;
    const right = cell.x1 - inset - padding;
    const top = cell.y0 + inset + padding;
    const bottom = cell.y1 - inset - padding;
    if (bounds.x >= left && bounds.x + bounds.width <= right && bounds.y >= top && bounds.y + bounds.height <= bottom) {
      labels.set(node.id, label);
    }
  });
  return labels;
}
function assertMethod(value) {
  if (typeof value === "function") return;
  if (value !== "squarify" && value !== "binary" && value !== "dice" && value !== "slice" && value !== "slice-dice") {
    throw new TypeError(`treemap: invalid method "${value}"`);
  }
}
function assertNonnegativeFinite(value, description) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `treemap: ${description} must be nonnegative and finite`
    );
  }
}
export {
  treemap
};
