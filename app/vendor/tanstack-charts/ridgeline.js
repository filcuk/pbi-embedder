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
function ridgelineY(source, options) {
  return ridgeline(source, options, options.x, options.y, "y");
}
function ridgelineX(source, options) {
  return ridgeline(source, options, options.y, options.x, "x");
}
function ridgeline(source, options, position, category, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const overlap = options.overlap ?? 1;
  if (!isFiniteNumber(overlap) || overlap <= 0) {
    throw new TypeError("ridgeline: overlap must be a positive finite number");
  }
  return createMark(({ markIndex }) => {
    const id = options.id ?? `ridgeline-${orientation}-${markIndex}`;
    const positionValues = channelValues(data, position, () => void 0);
    const categoryValues = channelValues(data, category, () => void 0);
    const heights = channelValues(data, options.height, () => void 0);
    heights.forEach((height, index) => {
      if (!isFiniteNumber(height)) return;
      if (height < 0 || height > 1) {
        throw new TypeError(
          `ridgeline: height must be between 0 and 1; received ${height} at index ${index}`
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
          values: positionValues.filter(isRidgelinePosition)
        },
        y: {
          scale: "y",
          values: categoryValues.filter(isChartKey)
        },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      } : {
        x: {
          scale: "x",
          values: categoryValues.filter(isChartKey)
        },
        y: {
          scale: "y",
          values: positionValues.filter(isRidgelinePosition)
        },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ chart, scales, color: resolveColor }) => {
        const categoryScale = orientation === "y" ? scales.y : scales.x;
        if (!isResolvedCategoryScale(categoryScale)) {
          throw new TypeError(
            `ridgeline${orientation.toUpperCase()}: the category axis requires a band or point scale`
          );
        }
        const positionScale = orientation === "y" ? scales.x : scales.y;
        if (!positionScale) {
          throw new TypeError(
            `ridgeline${orientation.toUpperCase()}: the profile axis scale is required`
          );
        }
        const span = orientation === "y" ? chart.height : chart.width;
        const step = resolvedCategoryStep(categoryScale, span, overlap * 2);
        const areas = [];
        const lines = [];
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
          let profile = [];
          let baselinePoints = [];
          let segmentPoints = [];
          let segmentIndex = 0;
          const flush = () => {
            if (!profile.length) return;
            const groupKey = valueKey(group);
            const interaction = {
              points: segmentPoints,
              affinity: orientation === "y" ? "x" : "y"
            };
            const profilePath = options.curve?.line(profile);
            areas.push({
              kind: "area",
              key: `${id}:${groupKey}:segment:${segmentIndex}:area`,
              points: [...profile, ...[...baselinePoints].reverse()],
              ...profilePath ? { path: closeProfilePath(profilePath, baselinePoints) } : {},
              interaction,
              style: {
                fill,
                fillOpacity: options.fillOpacity ?? 0.5
              }
            });
            if (stroke !== void 0) {
              lines.push({
                kind: "polyline",
                key: `${id}:${groupKey}:segment:${segmentIndex}:line`,
                points: profile,
                ...profilePath ? { path: profilePath } : {},
                interaction,
                style: {
                  fill: "none",
                  stroke,
                  strokeOpacity: options.strokeOpacity,
                  strokeWidth: options.strokeWidth ?? 1.5,
                  strokeDasharray: options.strokeDasharray
                }
              });
            }
            points.push(...segmentPoints);
            profile = [];
            baselinePoints = [];
            segmentPoints = [];
            segmentIndex += 1;
          };
          for (const index of indexes) {
            const positionValue = positionValues[index];
            const nextCategory = categoryValues[index];
            const height = heights[index];
            if (!isRidgelinePosition(positionValue) || !isChartKey(nextCategory) || !isFiniteNumber(height)) {
              flush();
              continue;
            }
            const positionPixel = positionScale.map(positionValue);
            const nextBaseline = categoryScale.map(nextCategory);
            if (!Number.isFinite(positionPixel) || !Number.isFinite(nextBaseline)) {
              flush();
              continue;
            }
            const profilePixel = nextBaseline + (orientation === "y" ? -1 : 1) * height * overlap * step;
            const x = orientation === "y" ? positionPixel : profilePixel;
            const y = orientation === "y" ? profilePixel : positionPixel;
            const key = `${id}:${valueKey(group)}:${valueKey(keys[index])}`;
            const point = {
              key,
              markId: id,
              group,
              groupLabel: String(nextCategory),
              datum: data[index],
              datumIndex: index,
              xValue: orientation === "y" ? positionValue : nextCategory,
              yValue: orientation === "y" ? nextCategory : positionValue,
              x,
              y,
              color: fill
            };
            profile.push([x, y]);
            baselinePoints.push(
              orientation === "y" ? [positionPixel, nextBaseline] : [nextBaseline, positionPixel]
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
              className: `ts-chart__ridgeline ts-chart__ridgeline-${orientation}`,
              ariaHidden: true,
              children: [
                {
                  kind: "group",
                  key: `${id}:areas`,
                  className: "ts-chart__area",
                  ariaHidden: true,
                  children: areas
                },
                {
                  kind: "group",
                  key: `${id}:lines`,
                  className: "ts-chart__line",
                  ariaHidden: true,
                  children: lines
                }
              ]
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function isRidgelinePosition(value) {
  return isFiniteNumber(value) || value instanceof Date && Number.isFinite(value.getTime());
}
function closeProfilePath(profilePath, baseline) {
  const first = baseline[0];
  const last = baseline.at(-1);
  if (!first || !last) return profilePath;
  return `${profilePath}L${last[0]},${last[1]}L${first[0]},${first[1]}Z`;
}
export {
  ridgelineX,
  ridgelineY
};
