import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  isChartValue,
  isFiniteNumber,
  visualValue
} from "./mark.js";
import {
  isResolvedCategoryScale,
  resolvedCategoryStep
} from "./mapped-spacing-internal.js";
import { valueKey } from "./scales.js";
function tickX(source, options) {
  return tick(source, options, "x");
}
function tickY(source, options) {
  return tick(source, options, "y");
}
function tick(source, options, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  if (options.length !== void 0 && options.span !== void 0) {
    throw new TypeError("tick: length and span are mutually exclusive");
  }
  if (options.span !== void 0 && (!isFiniteNumber(options.span) || options.span <= 0)) {
    throw new TypeError("tick: span must be a positive finite number");
  }
  return createMark(({ markIndex }) => {
    const id = options.id ?? `tick-${orientation}-${markIndex}`;
    const xValues = channelValues(data, options.x, () => void 0);
    const yValues = channelValues(data, options.y, () => void 0);
    const zValues = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, { groups: zValues });
    return {
      id,
      channels: {
        x: { scale: "x", values: xValues.filter(isChartValue) },
        y: { scale: "y", values: yValues.filter(isChartValue) },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ chart, scales, color: resolveColor }) => {
        const nodes = [];
        const points = [];
        const orthogonalScale = orientation === "x" ? scales.y : scales.x;
        const bandwidth = orthogonalScale.bandwidth;
        if (options.span !== void 0 && !isResolvedCategoryScale(orthogonalScale)) {
          throw new TypeError(
            `tick${orientation.toUpperCase()}: span requires a point or band scale on the orthogonal axis`
          );
        }
        const spanLength = options.span === void 0 ? void 0 : resolvedCategoryStep(
          orthogonalScale,
          orientation === "x" ? chart.height : chart.width,
          options.span
        ) * options.span;
        const availableLength = Math.max(
          0,
          (spanLength ?? options.length ?? (bandwidth || 6)) - (options.inset ?? 0) * 2
        );
        data.forEach((datum, datumIndex) => {
          const xValue = xValues[datumIndex];
          const yValue = yValues[datumIndex];
          if (!isChartValue(xValue) || !isChartValue(yValue)) return;
          const x = scales.x.map(xValue);
          const y = scales.y.map(yValue);
          const group = zValues[datumIndex] ?? null;
          const color = visualValue(
            options.stroke,
            datum,
            datumIndex,
            data,
            resolveColor(colorValues[datumIndex] ?? null)
          );
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          nodes.push({
            kind: "rule",
            key,
            x1: orientation === "x" ? x : x - availableLength / 2,
            x2: orientation === "x" ? x : x + availableLength / 2,
            y1: orientation === "x" ? y - availableLength / 2 : y,
            y2: orientation === "x" ? y + availableLength / 2 : y,
            style: {
              stroke: color,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth ?? 1.5,
              lineCap: "butt"
            }
          });
          points.push({
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue,
            yValue,
            x,
            y,
            color
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: `ts-chart__tick ts-chart__tick-${orientation}`,
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
export {
  tickX,
  tickY
};
