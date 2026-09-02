import { ticks } from "d3-array";
import { contourDensity } from "d3-contour";
import {
  channelValues,
  createMark,
  isChartKey,
  isFiniteNumber,
  visualValue
} from "./mark.js";
import {
  materializeLayoutXYRows,
  projectLayoutX,
  projectLayoutY
} from "./resolved-layout-position.js";
import { valueKey } from "./scales.js";
import {
  identifyContourLevels,
  mapContourPolygons,
  normalizeContourThresholds
} from "./spatial-contour-internal.js";
import { groupRowsByChartKey } from "./spatial-group-internal.js";
function densityContour(source, options) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const bandwidth = options.bandwidth ?? 20;
  const cellSize = options.cellSize ?? 4;
  const thresholds = normalizeContourThresholds(
    options.thresholds,
    20,
    "densityContour"
  );
  if (!isFiniteNumber(bandwidth) || bandwidth < 0) {
    throw new TypeError(
      "densityContour: bandwidth must be a nonnegative finite number"
    );
  }
  if (!isFiniteNumber(cellSize) || cellSize < 1) {
    throw new TypeError(
      "densityContour: cellSize must be a finite number greater than or equal to 1"
    );
  }
  const xValues = channelValues(data, options.x, () => void 0);
  const yValues = channelValues(data, options.y, () => void 0);
  const zValues = channelValues(data, options.z, () => null);
  const weightValues = channelValues(data, options.weight, () => 1);
  const sourceRows = materializeLayoutXYRows(data, xValues, yValues).flatMap((row) => {
    const weight = weightValues[row.sourceIndex];
    if (!isFiniteNumber(weight) || weight === 0) return [];
    const groupValue = zValues[row.sourceIndex];
    return [
      {
        ...row,
        group: isChartKey(groupValue) ? groupValue : null,
        weight
      }
    ];
  });
  return createMark(({ markIndex }) => {
    const id = options.id ?? `density-contour-${markIndex}`;
    return {
      id,
      channels: {
        x: { scale: "x", values: sourceRows.map((row) => row.xValue) },
        y: { scale: "y", values: sourceRows.map((row) => row.yValue) }
      },
      resolveLayout: ({ chart, scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        if (!xScale || !yScale) {
          throw new TypeError("densityContour: x and y scales are required");
        }
        const rows = projectLayoutY(
          projectLayoutX(sourceRows, xValues, xScale),
          yValues,
          yScale
        );
        const groups = groupRowsByChartKey(rows);
        const contourFunctions = groups.map(({ rows: groupRows }) => ({
          rows: groupRows,
          contour: createDensityEstimator(
            chart.width,
            chart.height,
            chart.x,
            chart.y,
            bandwidth,
            cellSize
          ).contours(groupRows)
        }));
        const levels = typeof thresholds === "number" ? sharedThresholds(
          contourFunctions.map(({ contour }) => contour.max),
          thresholds
        ) : thresholds;
        const identifiedLevels = identifyContourLevels(
          levels,
          typeof thresholds === "number" ? { kind: "generated", count: thresholds } : { kind: "explicit" }
        );
        const contours = contourFunctions.flatMap(
          ({ rows: groupRows, contour }) => materializeContours(data, groupRows, contour, identifiedLevels)
        );
        const derivedData = contours.map(({ datum }) => datum);
        const colorValues = channelValues(
          derivedData,
          options.color,
          (datum) => datum.group
        );
        return {
          channels: {
            x: { scale: "x", values: sourceRows.map((row) => row.xValue) },
            y: { scale: "y", values: sourceRows.map((row) => row.yValue) },
            color: {
              scale: "color",
              values: options.color === "density" ? [0, ...colorValues.filter(isChartKey)] : colorValues.filter(isChartKey)
            }
          },
          render: ({ color: resolveColor }) => ({
            nodes: [
              {
                kind: "group",
                key: id,
                className: "ts-chart__area ts-chart__density-contour",
                ariaHidden: true,
                translateX: chart.x,
                translateY: chart.y,
                clip: { x: 0, y: 0, width: chart.width, height: chart.height },
                children: contours.map(
                  (contour, index) => contourNode(
                    id,
                    contour,
                    index,
                    derivedData,
                    colorValues,
                    resolveColor,
                    options
                  )
                )
              }
            ]
          })
        };
      }
    };
  }, options.motion);
}
function createDensityEstimator(width, height, originX, originY, bandwidth, cellSize) {
  return contourDensity().x((row) => row.x - originX).y((row) => row.y - originY).weight((row) => row.weight).size([width, height]).bandwidth(bandwidth).cellSize(cellSize);
}
function materializeContours(data, rows, contour, levels) {
  const sourceIndexes = rows.map((row) => row.sourceIndex);
  const source = sourceIndexes.map((index) => data[index]);
  const group = rows[0]?.group ?? null;
  return levels.flatMap(({ value: density, identity }) => {
    const geometry = contour(density);
    const polygons = mapContourPolygons(geometry.coordinates);
    if (!polygons.length) return [];
    return [
      {
        datum: { density, group, source, sourceIndexes },
        polygons,
        levelIdentity: identity
      }
    ];
  });
}
function contourNode(id, contour, index, data, colorValues, resolveColor, options) {
  const colorValue = colorValues[index];
  const fallback = resolveColor(isChartKey(colorValue) ? colorValue : null);
  return {
    kind: "area",
    key: JSON.stringify([
      id,
      valueKey(contour.datum.group),
      contour.levelIdentity
    ]),
    points: [],
    polygons: contour.polygons,
    style: {
      fill: visualValue(options.fill, contour.datum, index, data, fallback),
      fillOpacity: options.fillOpacity,
      stroke: options.stroke === void 0 ? void 0 : visualValue(options.stroke, contour.datum, index, data, fallback),
      strokeOpacity: options.strokeOpacity,
      strokeWidth: options.strokeWidth,
      strokeDasharray: options.strokeDasharray,
      opacity: options.opacity
    }
  };
}
function sharedThresholds(maxima, count) {
  const maximum = Math.max(0, ...maxima.filter(isFiniteNumber));
  return maximum > 0 ? ticks(Number.MIN_VALUE, maximum, count) : [];
}
export {
  densityContour
};
