import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  isFiniteNumber,
  markStates,
  visualValue
} from "./mark.js";
import {
  isResolvedCategoryScale,
  resolvedCategoryStep
} from "./mapped-spacing-internal.js";
import { valueKey } from "./scales.js";
import { groupedIndexes } from "./transform-internal.js";
function violinY(source, options) {
  return violin(source, options, options.y, options.x, options.curve, "y");
}
function violinX(source, options) {
  return violin(source, options, options.x, options.y, options.curve, "x");
}
function violin(source, options, position, category, curve, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const span = options.span ?? 0.8;
  if (!isFiniteNumber(span) || span <= 0) {
    throw new TypeError("violin: span must be a positive finite number");
  }
  return createMark(({ markIndex }) => {
    const id = options.id ?? `violin-${orientation}-${markIndex}`;
    const positionValues = channelValues(data, position, () => void 0);
    const categoryValues = channelValues(data, category, () => void 0);
    const widths = channelValues(data, options.width, () => void 0);
    widths.forEach((width, index) => {
      if (!isFiniteNumber(width)) return;
      if (width < 0 || width > 1) {
        throw new TypeError(
          `violin: width must be between 0 and 1; received ${width} at index ${index}`
        );
      }
    });
    const categoryKeys = categoryValues.map(
      (value) => isChartKey(value) ? value : null
    );
    const colorValues = options.color === void 0 ? categoryKeys : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, {
      groups: categoryKeys,
      candidates: [positionValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      states: markStates(data, options.states),
      channels: orientation === "y" ? {
        x: {
          scale: "x",
          values: categoryValues.filter(isChartKey)
        },
        y: {
          scale: "y",
          values: positionValues.filter(isViolinPosition)
        },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      } : {
        x: {
          scale: "x",
          values: positionValues.filter(isViolinPosition)
        },
        y: {
          scale: "y",
          values: categoryValues.filter(isChartKey)
        },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ chart, scales, color: resolveColor }) => {
        const categoryScale = orientation === "y" ? scales.x : scales.y;
        if (!isResolvedCategoryScale(categoryScale)) {
          throw new TypeError(
            `violin${orientation.toUpperCase()}: the category axis requires a band or point scale`
          );
        }
        const positionScale = orientation === "y" ? scales.y : scales.x;
        if (!positionScale) {
          throw new TypeError(
            `violin${orientation.toUpperCase()}: the profile axis scale is required`
          );
        }
        const plotSpan = orientation === "y" ? chart.width : chart.height;
        const step = resolvedCategoryStep(categoryScale, plotSpan, span);
        const areas = [];
        const points = [];
        for (const { key: group, indexes } of groupedIndexes(categoryKeys)) {
          const firstIndex = indexes.find(
            (index) => isChartKey(categoryValues[index])
          );
          if (firstIndex === void 0) continue;
          const categoryValue = categoryValues[firstIndex];
          const baseline = categoryScale.map(categoryValue);
          if (!Number.isFinite(baseline)) continue;
          const datum = data[firstIndex];
          const fallback = resolveColor(colorValues[firstIndex] ?? null);
          const fill = visualValue(
            options.fill,
            datum,
            firstIndex,
            data,
            fallback
          );
          const stroke = options.stroke === null ? void 0 : visualValue(options.stroke, datum, firstIndex, data, fallback);
          let positive = [];
          let negative = [];
          let segmentPoints = [];
          let segmentIndex = 0;
          const flush = () => {
            if (!positive.length) return;
            const reversedNegative = [...negative].reverse();
            const path = violinPath(curve, orientation, positive, negative);
            areas.push({
              kind: "area",
              key: `${id}:${valueKey(group)}:segment:${segmentIndex}`,
              points: [...positive, ...reversedNegative],
              ...path ? { path } : {},
              interaction: {
                points: segmentPoints,
                affinity: orientation
              },
              style: {
                fill,
                fillOpacity: options.fillOpacity ?? 0.5,
                stroke,
                strokeOpacity: options.strokeOpacity,
                strokeWidth: options.strokeWidth ?? 1.5,
                strokeDasharray: options.strokeDasharray
              }
            });
            points.push(...segmentPoints);
            positive = [];
            negative = [];
            segmentPoints = [];
            segmentIndex += 1;
          };
          for (const index of indexes) {
            const positionValue = positionValues[index];
            const nextCategory = categoryValues[index];
            const width = widths[index];
            if (!isViolinPosition(positionValue) || !isChartKey(nextCategory) || !isFiniteNumber(width)) {
              flush();
              continue;
            }
            const positionPixel = positionScale.map(positionValue);
            const nextBaseline = categoryScale.map(nextCategory);
            if (!Number.isFinite(positionPixel) || !Number.isFinite(nextBaseline)) {
              flush();
              continue;
            }
            const halfWidth = width * span * step / 2;
            const key = `${id}:${valueKey(group)}:${valueKey(keys[index])}`;
            const x = orientation === "y" ? nextBaseline : positionPixel;
            const y = orientation === "y" ? positionPixel : nextBaseline;
            const point = {
              key,
              markId: id,
              group,
              groupLabel: String(nextCategory),
              datum: data[index],
              datumIndex: index,
              xValue: orientation === "y" ? nextCategory : positionValue,
              yValue: orientation === "y" ? positionValue : nextCategory,
              x,
              y,
              color: fill
            };
            positive.push(
              orientation === "y" ? [nextBaseline + halfWidth, positionPixel] : [positionPixel, nextBaseline - halfWidth]
            );
            negative.push(
              orientation === "y" ? [nextBaseline - halfWidth, positionPixel] : [positionPixel, nextBaseline + halfWidth]
            );
            segmentPoints.push(point);
          }
          flush();
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: `ts-chart__area ts-chart__violin ts-chart__violin-${orientation}`,
              ariaHidden: true,
              children: areas
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function isViolinPosition(value) {
  return isFiniteNumber(value) || value instanceof Date && Number.isFinite(value.getTime());
}
function violinPath(curve, orientation, positive, negative) {
  if (!curve) return void 0;
  if (orientation === "y") {
    if (!("areaX" in curve)) {
      throw new TypeError("violinY: curve must provide an areaX generator");
    }
    return curve.areaX(positive, negative);
  }
  if (!("area" in curve)) {
    throw new TypeError("violinX: curve must provide an area generator");
  }
  return curve.area(positive, negative);
}
export {
  violinX,
  violinY
};
