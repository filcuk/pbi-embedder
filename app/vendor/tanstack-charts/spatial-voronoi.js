import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  visualValue
} from "./mark.js";
import {
  materializeLayoutXYRows,
  projectLayoutX,
  projectLayoutY
} from "./resolved-layout-position.js";
import { valueKey } from "./scales.js";
import { canonicalDelaunayPoints } from "./spatial-delaunay-internal.js";
import { groupRowsByChartKey } from "./spatial-group-internal.js";
import { voronoiCellPolygons } from "./spatial-voronoi-internal.js";
function voronoi(source, options) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const xValues = channelValues(data, options.x, () => void 0);
  const yValues = channelValues(data, options.y, () => void 0);
  const zValues = channelValues(data, options.z, () => null);
  const colorValues = channelValues(data, options.color, () => null);
  const completeRows = materializeLayoutXYRows(data, xValues, yValues);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `voronoi-${markIndex}`;
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
        y: { scale: "y", values: completeRows.map((row) => row.yValue) },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ chart, scales, color: resolveColor }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        if (!xScale || !yScale) {
          throw new TypeError("voronoi: x and y scales are required");
        }
        const rows = projectLayoutY(
          projectLayoutX(sourceRows, xValues, xScale),
          yValues,
          yScale
        );
        const nodes = groupRowsByChartKey(rows).flatMap(
          ({ rows: groupRows }) => createCellNodes(
            id,
            data,
            canonicalDelaunayPoints(groupRows),
            chart,
            colorValues,
            resolveColor,
            options
          )
        );
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__voronoi",
              ariaHidden: true,
              children: nodes
            }
          ]
        };
      }
    };
  }, options.motion);
}
function createCellNodes(id, data, rows, chart, colorValues, resolveColor, options) {
  return voronoiCellPolygons(rows, chart).map(({ pointIndex, points }) => {
    const row = rows[pointIndex];
    const datum = row.datum;
    const datumIndex = row.sourceIndex;
    const colorValue = colorValues[datumIndex];
    const fallback = resolveColor(isChartKey(colorValue) ? colorValue : null);
    return {
      kind: "area",
      key: JSON.stringify([id, valueKey(row.group), valueKey(row.key)]),
      points,
      style: {
        fill: visualValue(options.fill, datum, datumIndex, data, fallback),
        fillOpacity: options.fillOpacity,
        stroke: options.stroke === void 0 ? void 0 : visualValue(options.stroke, datum, datumIndex, data, fallback),
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth,
        strokeDasharray: options.strokeDasharray,
        opacity: options.opacity
      }
    };
  });
}
export {
  voronoi
};
