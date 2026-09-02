import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey
} from "./mark.js";
import { adoptResolvedChildMark } from "./resolved-layout-child.js";
import { projectLayoutX, projectLayoutY } from "./resolved-layout-position.js";
import { compareChartKey, valueKey } from "./scales.js";
import { groupRowsByChartKey } from "./spatial-group-internal.js";
import {
  canonicalDelaunayPoints,
  delaunayNeighborPairs
} from "./spatial-delaunay-internal.js";
import { link } from "./link.js";
import { materializeLayoutXYRows } from "./resolved-layout-position.js";
function delaunayLink(source, options) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const xValues = channelValues(data, options.x, () => void 0);
  const yValues = channelValues(data, options.y, () => void 0);
  const zValues = channelValues(data, options.z, () => null);
  const completeRows = materializeLayoutXYRows(data, xValues, yValues);
  const { x: _x, y: _y, z: _z, key: _key, motion, ...presentation } = options;
  return createMark(({ markIndex }) => {
    const id = options.id ?? `delaunay-link-${markIndex}`;
    const groups = data.map((_datum, index) => {
      const group = zValues[index];
      return isChartKey(group) ? group : null;
    });
    const keys = inferredKeyValues(data, options.key, {
      groups,
      markId: id,
      warningIdentity: options
    });
    const sourceRows = completeRows.map(
      (row) => ({
        ...row,
        group: groups[row.sourceIndex] ?? null,
        key: keys[row.sourceIndex] ?? row.sourceIndex
      })
    );
    return {
      id,
      channels: {
        x: { scale: "x", values: completeRows.map((row) => row.xValue) },
        y: { scale: "y", values: completeRows.map((row) => row.yValue) }
      },
      resolveLayout: ({ scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        if (!xScale || !yScale) {
          throw new TypeError("delaunayLink: x and y scales are required");
        }
        const rows = projectLayoutY(
          projectLayoutX(sourceRows, xValues, xScale),
          yValues,
          yScale
        );
        const edges = groupRowsByChartKey(rows).flatMap(({ rows: groupRows }) => createEdges(groupRows)).sort((left, right) => compareText(left.edgeKey, right.edgeKey));
        const child = link(edges, {
          ...presentation,
          id,
          x1: "x1",
          y1: "y1",
          x2: "x2",
          y2: "y2",
          z: "group",
          key: "edgeKey"
        });
        return adoptResolvedChildMark(child.initialize({ markIndex }));
      }
    };
  }, motion);
}
function createEdges(rows) {
  const orderedRows = canonicalDelaunayPoints(rows);
  return delaunayNeighborPairs(orderedRows).map(([leftIndex, rightIndex]) => {
    const left = orderedRows[leftIndex];
    const right = orderedRows[rightIndex];
    const [source, target] = canonicalEndpoints(left, right);
    return {
      edgeKey: JSON.stringify([
        valueKey(source.group),
        valueKey(source.key),
        valueKey(target.key)
      ]),
      group: source.group,
      source: source.datum,
      sourceIndex: source.sourceIndex,
      sourceKey: source.key,
      target: target.datum,
      targetIndex: target.sourceIndex,
      targetKey: target.key,
      x1: source.xValue,
      y1: source.yValue,
      x2: target.xValue,
      y2: target.yValue
    };
  });
}
function canonicalEndpoints(left, right) {
  const leftKey = valueKey(left.key);
  const rightKey = valueKey(right.key);
  return compareChartKey(left.key, right.key) < 0 || leftKey === rightKey && left.sourceIndex <= right.sourceIndex ? [left, right] : [right, left];
}
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
export {
  delaunayLink
};
