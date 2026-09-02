import {
  channelValues,
  inferredKeyValues,
  isChartKey,
  isFiniteNumber,
  markStates,
  visualValue
} from "./mark.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { valueKey } from "./scales.js";
function waffleY(source, options) {
  return waffle(source, options, "y");
}
function waffleX(source, options) {
  return waffle(source, options, "x");
}
function waffle(source, options, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const unit = options.unit ?? 1;
  const gap = options.gap ?? 1;
  const fixedMultiple = orientation === "y" ? options.columns : options.rows;
  if (!isFiniteNumber(unit) || unit <= 0) {
    throw new TypeError("waffle: unit must be a positive finite number");
  }
  if (!isFiniteNumber(gap) || gap < 0) {
    throw new TypeError("waffle: gap must be a nonnegative finite number");
  }
  if (fixedMultiple !== void 0 && (!Number.isInteger(fixedMultiple) || fixedMultiple <= 0)) {
    throw new TypeError(
      `waffle${orientation.toUpperCase()}: ${orientation === "y" ? "columns" : "rows"} must be a positive integer`
    );
  }
  return createMarkWithScaleValues(
    ({ markIndex }) => {
      const id = options.id ?? `waffle-${orientation}-${markIndex}`;
      const valueChannel = orientation === "y" ? options.y : options.x;
      const values = channelValues(
        data,
        valueChannel,
        (datum) => typeof datum === "number" ? datum : void 0
      );
      const zValues = channelValues(data, options.z, () => null);
      const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
      const groupValues = options.z === void 0 && options.color !== void 0 ? colorValues : zValues;
      const keys = inferredKeyValues(data, options.key, {
        groups: groupValues,
        markId: id,
        warningIdentity: options
      });
      const segments = materializeSegments(values, unit, options.round ?? false);
      return {
        id,
        states: markStates(data, options.states),
        seriesFromColor: options.z === void 0 && options.color !== void 0,
        channels: {
          color: {
            scale: "color",
            values: colorValues.filter(isChartKey)
          }
        },
        resolveLayout: ({ chart }) => {
          const laidOut = layoutWaffle(
            segments,
            chart,
            orientation,
            fixedMultiple,
            gap
          );
          return {
            render: ({ color: resolveColor }) => {
              const nodes = [];
              const points = [];
              for (const segment of laidOut) {
                const datum = data[segment.sourceIndex];
                if (segment.fragments.length === 0) continue;
                const group = groupValues[segment.sourceIndex] ?? null;
                const fallback = resolveColor(
                  colorValues[segment.sourceIndex] ?? null
                );
                const fill = visualValue(
                  options.fill,
                  datum,
                  segment.sourceIndex,
                  data,
                  fallback
                );
                const stroke = options.stroke === void 0 ? void 0 : visualValue(
                  options.stroke,
                  datum,
                  segment.sourceIndex,
                  data,
                  fallback
                );
                const key = `${id}:${valueKey(group)}:${valueKey(keys[segment.sourceIndex])}`;
                const anchor = segment.fragments[Math.floor((segment.fragments.length - 1) / 2)];
                const crossValue = group ?? keys[segment.sourceIndex];
                const point = {
                  key,
                  markId: id,
                  group,
                  groupLabel: group == null ? id : String(group),
                  datum,
                  datumIndex: segment.sourceIndex,
                  xValue: orientation === "y" ? crossValue : segment.value,
                  yValue: orientation === "y" ? segment.value : crossValue,
                  ...orientation === "y" ? {
                    y1Value: segment.startValue,
                    y2Value: segment.endValue,
                    yInterval: "difference"
                  } : {
                    x1Value: segment.startValue,
                    x2Value: segment.endValue,
                    xInterval: "difference"
                  },
                  x: anchor.x + anchor.width / 2,
                  y: anchor.y + anchor.height / 2,
                  color: fill
                };
                points.push(point);
                segment.fragments.forEach((fragment, fragmentIndex) => {
                  nodes.push({
                    kind: "rect",
                    key: `${key}:unit:${fragmentIndex}`,
                    x: fragment.x,
                    y: fragment.y,
                    width: fragment.width,
                    height: fragment.height,
                    radius: fragment.complete ? options.radius : void 0,
                    interaction: { point },
                    style: {
                      fill,
                      fillOpacity: options.fillOpacity,
                      stroke,
                      strokeOpacity: options.strokeOpacity,
                      strokeWidth: options.strokeWidth
                    }
                  });
                });
              }
              return {
                nodes: [
                  {
                    kind: "group",
                    key: id,
                    className: `ts-chart__waffle ts-chart__waffle-${orientation}`,
                    ariaHidden: true,
                    children: nodes
                  }
                ],
                points
              };
            }
          };
        }
      };
    },
    options.motion
  );
}
function materializeSegments(values, unit, round) {
  const segments = [];
  let cumulative = 0;
  values.forEach((value, sourceIndex) => {
    if (!isFiniteNumber(value)) return;
    if (value < 0) {
      throw new TypeError("waffle: values must be nonnegative finite numbers");
    }
    const startValue = cumulative;
    const startUnit = cumulative / unit;
    cumulative += value;
    const endUnit = cumulative / unit;
    const roundedStart = round ? Math.round(startUnit) : startUnit;
    const roundedEnd = round ? Math.round(endUnit) : endUnit;
    if (!Number.isSafeInteger(Math.ceil(roundedStart)) || !Number.isSafeInteger(Math.ceil(roundedEnd))) {
      throw new TypeError(
        "waffle: cumulative unit coordinates must remain finite safe numbers"
      );
    }
    if (roundedEnd <= roundedStart) return;
    segments.push({
      sourceIndex,
      value,
      startValue,
      endValue: cumulative,
      startUnit: roundedStart,
      endUnit: roundedEnd
    });
  });
  return segments;
}
function layoutWaffle(segments, chart, orientation, fixedMultiple, gap) {
  const cellCount = Math.ceil(segments.at(-1)?.endUnit ?? 0);
  if (cellCount <= 0) return [];
  const multiple = fixedMultiple ?? chooseMultiple(cellCount, chart, orientation);
  const columns = orientation === "y" ? multiple : Math.ceil(cellCount / multiple);
  const rows = orientation === "y" ? Math.ceil(cellCount / multiple) : multiple;
  const cellSize = Math.max(
    0,
    Math.min(chart.width / columns, chart.height / rows)
  );
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const gridX = chart.x + (chart.width - gridWidth) / 2;
  const gridY = chart.y + (chart.height - gridHeight) / 2;
  const inset = Math.min(gap, cellSize) / 2;
  const paintSize = Math.max(0, cellSize - inset * 2);
  return segments.map((segment) => {
    const fragments = [];
    const firstCell = Math.floor(segment.startUnit);
    const lastCell = Math.ceil(segment.endUnit);
    for (let unitIndex = firstCell; unitIndex < lastCell; unitIndex += 1) {
      const start = Math.max(segment.startUnit, unitIndex) - unitIndex;
      const end = Math.min(segment.endUnit, unitIndex + 1) - unitIndex;
      if (end <= start) continue;
      const column = orientation === "y" ? unitIndex % columns : Math.floor(unitIndex / rows);
      const row = orientation === "y" ? Math.floor(unitIndex / columns) : unitIndex % rows;
      const cellX = gridX + column * cellSize + inset;
      const cellY = gridY + (rows - row - 1) * cellSize + inset;
      const complete = start === 0 && end === 1;
      fragments.push(
        orientation === "y" ? {
          x: cellX,
          y: cellY + (1 - end) * paintSize,
          width: paintSize,
          height: (end - start) * paintSize,
          complete
        } : {
          x: cellX + start * paintSize,
          y: cellY,
          width: (end - start) * paintSize,
          height: paintSize,
          complete
        }
      );
    }
    return { ...segment, fragments };
  });
}
function chooseMultiple(cellCount, chart, orientation) {
  let best = 1;
  let bestSize = -1;
  let bestUnused = Infinity;
  for (let candidate = 1; candidate <= cellCount; candidate += 1) {
    const columns = orientation === "y" ? candidate : Math.ceil(cellCount / candidate);
    const rows = orientation === "y" ? Math.ceil(cellCount / candidate) : candidate;
    const size = Math.min(chart.width / columns, chart.height / rows);
    const unused = chart.width * chart.height - columns * rows * size * size;
    if (size > bestSize || size === bestSize && unused < bestUnused) {
      best = candidate;
      bestSize = size;
      bestUnused = unused;
    }
  }
  return best;
}
export {
  waffleX,
  waffleY
};
