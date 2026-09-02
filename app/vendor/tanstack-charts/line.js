import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  isChartValue,
  isFiniteNumber,
  markStates,
  visualValue
} from "./mark.js";
import { valueKey } from "./scales.js";
function lineY(source, options = {}) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createLineMark(data, options, "line", () => {
    const xValues = channelValues(data, options.x, (_datum, { index }) => index);
    const yValues = channelValues(
      data,
      options.y,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    return {
      xValues,
      yValues,
      isValidX: isChartValue,
      isValidY: isFiniteNumber,
      keyValues: xValues,
      affinity: "x"
    };
  });
}
function lineX(source, options = {}) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createLineMark(data, options, "line-x", () => {
    const xValues = channelValues(
      data,
      options.x,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const yValues = channelValues(data, options.y, (_datum, { index }) => index);
    return {
      xValues,
      yValues,
      isValidX: isFiniteNumber,
      isValidY: isChartValue,
      keyValues: yValues,
      affinity: "y"
    };
  });
}
function createLineMark(data, options, idPrefix, channels) {
  return createMark(({ markIndex }) => {
    const id = options.id ?? `${idPrefix}-${markIndex}`;
    const { xValues, yValues, isValidX, isValidY, keyValues, affinity } = channels();
    const zValues = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
    const groupValues = options.z === void 0 && options.color !== void 0 ? colorValues : zValues;
    const keys = inferredKeyValues(data, options.key, {
      groups: groupValues,
      candidates: [keyValues],
      markId: id,
      warningIdentity: options
    });
    const rows = data.map((datum, datumIndex) => ({
      datum,
      datumIndex,
      xValue: xValues[datumIndex],
      yValue: yValues[datumIndex],
      groupValue: groupValues[datumIndex],
      datumKey: keys[datumIndex]
    }));
    return {
      id,
      states: markStates(data, options.states),
      seriesFromColor: options.z === void 0 && options.color !== void 0,
      channels: {
        x: {
          scale: "x",
          values: xValues.filter(isValidX)
        },
        y: {
          scale: "y",
          values: yValues.filter(isValidY)
        },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ scales, color: resolveColor }) => {
        const groups = groupRows(rows);
        const nodes = [];
        for (const [groupKey, groupRows2] of groups) {
          const firstRow = groupRows2[0];
          if (!firstRow) continue;
          const color = visualValue(
            options.stroke,
            firstRow.datum,
            firstRow.datumIndex,
            data,
            resolveColor(colorValues[firstRow.datumIndex] ?? null)
          );
          const children = [];
          let segment = [];
          let segmentPoints = [];
          let segmentIndex = 0;
          const flushSegment = () => {
            if (!segment.length) return;
            children.push({
              kind: "polyline",
              key: `${id}:${groupKey}:segment:${segmentIndex}`,
              points: segment,
              path: options.curve?.line(segment),
              interaction: {
                points: segmentPoints,
                affinity
              },
              style: {
                fill: "none",
                stroke: color,
                strokeOpacity: options.strokeOpacity,
                strokeWidth: options.strokeWidth ?? 2.25,
                strokeDasharray: options.strokeDasharray,
                lineCap: "round",
                lineJoin: "round"
              }
            });
            segment = [];
            segmentPoints = [];
            segmentIndex += 1;
          };
          for (const row of groupRows2) {
            if (!isValidX(row.xValue) || !isValidY(row.yValue)) {
              flushSegment();
              continue;
            }
            const x = scales.x.map(row.xValue);
            const y = scales.y.map(row.yValue);
            const point = {
              key: `${id}:${groupKey}:${valueKey(row.datumKey)}`,
              markId: id,
              group: row.groupValue ?? null,
              groupLabel: row.groupValue == null ? id : String(row.groupValue),
              datum: row.datum,
              datumIndex: row.datumIndex,
              xValue: row.xValue,
              yValue: row.yValue,
              x,
              y,
              color
            };
            segmentPoints.push(point);
            segment.push([x, y]);
            if (options.points) {
              children.push({
                kind: "dot",
                key: `${point.key}:dot`,
                x,
                y,
                radius: 2.5,
                pointOwner: point,
                style: { fill: color }
              });
            }
          }
          flushSegment();
          nodes.push({
            kind: "group",
            key: `${id}:${groupKey}`,
            className: "ts-chart__line",
            ariaHidden: true,
            children
          });
        }
        return { nodes };
      }
    };
  }, options.motion);
}
function groupRows(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = valueKey(row.groupValue ?? null);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
export {
  lineX,
  lineY
};
