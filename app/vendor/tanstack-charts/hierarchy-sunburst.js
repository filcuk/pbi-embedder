import { partition as createPartition } from "d3-hierarchy";
import { pointRadial } from "d3-shape";
import {
  aggregateFlatHierarchyValues,
  buildFlatHierarchy,
  flatHierarchyAncestorIds,
  flatHierarchyBranchId,
  flatHierarchyNodeContext,
  flatHierarchyNodeValue
} from "./hierarchy-flat-internal.js";
import { channelValues, isChartKey, isFiniteNumber, visualValue } from "./mark.js";
import { createPolarMark } from "./polar-mark-internal.js";
import { resolvePolarSector } from "./polar-sector-internal.js";
import { valueKey } from "./scales.js";
function sunburst(source, options) {
  const hierarchyOptions = options.path !== void 0 ? { path: options.path, delimiter: options.delimiter } : {
    id: options.nodeId,
    parentId: options.parentId
  };
  const hierarchy = buildFlatHierarchy(source, hierarchyOptions, "sunburst");
  aggregateFlatHierarchyValues(hierarchy, options.value, "sunburst");
  const contexts = /* @__PURE__ */ new WeakMap();
  const context = (node) => {
    const existing = contexts.get(node);
    if (existing) return existing;
    const created = Object.freeze(sunburstNodeContext(node));
    contexts.set(node, created);
    return created;
  };
  if (options.sort) {
    hierarchy.root.sort((left, right) => {
      const compared = options.sort(
        context(left),
        context(right)
      );
      if (!isFiniteNumber(compared)) {
        throw new TypeError("sunburst: sort result must be finite");
      }
      return compared;
    });
  }
  const ringPadding = options.ringPadding ?? 0;
  assertNonnegativeFinite(ringPadding, "ringPadding");
  const ringCount = hierarchy.root.height;
  const partitioned = createPartition().size([
    1,
    Math.max(1, ringCount + 1)
  ])(hierarchy.root);
  const nodes = partitioned.descendants().slice(1).filter((node) => node.x1 > node.x0).map((node) => ({
    node: context(node),
    start: node.x0,
    end: node.x1
  }));
  return createPolarMark(
    ({ markIndex, parentId }) => {
      const id = options.id ?? `${parentId}:sunburst-${markIndex}`;
      const data = nodes.map(({ node }) => node);
      const groups = channelValues(data, options.z, () => null);
      const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
      return {
        id,
        colorValues: colorValues.filter(isChartKey),
        angleValues: [],
        radiusValues: [],
        includeZeroRadius: false,
        requiresAngleScale: false,
        requiresRadiusScale: false,
        render: ({ layout, color: resolveColor }) => {
          const innerRadius = resolveRadius(
            options.innerRadius,
            layout,
            0,
            "innerRadius"
          );
          const outerRadius = resolveRadius(
            options.outerRadius,
            layout,
            layout.radius,
            "outerRadius"
          );
          const span = outerRadius - innerRadius;
          const direction = span < 0 ? -1 : 1;
          const usableSpan = Math.max(
            0,
            Math.abs(span) - ringPadding * Math.max(0, ringCount - 1)
          );
          const ringSize = ringCount === 0 ? 0 : usableSpan / ringCount;
          const angularSpan = layout.endAngle - layout.startAngle;
          const children = [];
          const points = [];
          nodes.forEach(({ node, start, end }, nodeIndex) => {
            if (ringSize <= 0) return;
            const startAngle = layout.startAngle + start * angularSpan;
            const endAngle = layout.startAngle + end * angularSpan;
            if (!isFiniteNumber(startAngle) || !isFiniteNumber(endAngle) || Math.abs(endAngle - startAngle) <= 1e-12) {
              return;
            }
            const ringOffset = (node.depth - 1) * (ringSize + ringPadding);
            const radius1 = innerRadius + direction * ringOffset;
            const radius2 = radius1 + direction * ringSize;
            const sector = resolvePolarSector({
              startAngle,
              endAngle,
              innerRadius: radius1,
              outerRadius: radius2,
              cornerRadius: 0
            });
            if (!sector) return;
            const group = groups[nodeIndex] ?? null;
            const fallback = resolveColor(colorValues[nodeIndex] ?? null);
            const fill = visualValue(
              options.fill,
              node,
              nodeIndex,
              data,
              fallback
            );
            const stroke = options.stroke === void 0 ? void 0 : visualValue(options.stroke, node, nodeIndex, data, fallback);
            const key = `${id}:node:${valueKey(node.id)}`;
            const angle = (startAngle + endAngle) / 2;
            const radius = (radius1 + radius2) / 2;
            const [x, y] = pointRadial(angle, radius);
            const point = {
              key,
              markId: id,
              group,
              groupLabel: group === null ? id : String(group),
              datum: node,
              datumIndex: nodeIndex,
              xValue: angle,
              yValue: radius,
              x: layout.centerX + x,
              y: layout.centerY + y,
              color: fill
            };
            children.push({
              kind: "area",
              key,
              points: sector.points,
              path: sector.path,
              interaction: { point, affinity: "geometry" },
              style: {
                fill,
                fillOpacity: options.fillOpacity,
                stroke,
                strokeOpacity: options.strokeOpacity,
                strokeWidth: options.strokeWidth,
                strokeDasharray: options.strokeDasharray,
                opacity: options.opacity,
                lineJoin: "round"
              }
            });
            points.push(point);
          });
          return {
            nodes: [
              {
                kind: "group",
                key: id,
                className: classes(
                  "ts-chart__arc ts-chart__sunburst",
                  options.className
                ),
                ariaHidden: true,
                children
              }
            ],
            points
          };
        }
      };
    },
    options.motion
  );
}
function sunburstNodeContext(node) {
  return {
    ...flatHierarchyNodeContext(node),
    ancestorIds: flatHierarchyAncestorIds(node),
    branchId: flatHierarchyBranchId(node),
    value: flatHierarchyNodeValue(node)
  };
}
function resolveRadius(value, layout, fallback, description) {
  const resolved = typeof value === "function" ? value(layout) : value;
  const radius = resolved ?? fallback;
  assertNonnegativeFinite(radius, description);
  return radius;
}
function assertNonnegativeFinite(value, description) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `sunburst: ${description} must be nonnegative and finite`
    );
  }
}
function classes(base, custom) {
  return custom ? `${base} ${custom}` : base;
}
export {
  sunburst
};
