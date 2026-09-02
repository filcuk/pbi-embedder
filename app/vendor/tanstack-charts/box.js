import { barX, barY } from "./bar.js";
import { dot } from "./dot.js";
import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartValue
} from "./mark.js";
import { initializeCompositeMark } from "./mark-composite-internal.js";
import { link } from "./link.js";
import { valueKey } from "./scales.js";
import { tickX, tickY } from "./tick.js";
import { groupedIndexes, toArray, transformValues } from "./transform-internal.js";
import { quantileSortedValues } from "./transform-statistics-internal.js";
function boxRows(source, options) {
  const data = toArray(source);
  const { summaries, outliers } = summarizeBoxes(
    data,
    transformValues(data, options.category),
    transformValues(data, options.value)
  );
  return [...summaries, ...outliers];
}
function boxY(source, options) {
  return box(source, options, options.x, options.y, "y");
}
function boxX(source, options) {
  return box(source, options, options.y, options.x, "x");
}
const interactiveBoxChildren = /* @__PURE__ */ new Set(["box", "outlier"]);
function box(source, options, category, numeric, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `box-${orientation}-${markIndex}`;
    const categoryValues = channelValues(data, category, () => void 0);
    const numericValues = channelValues(data, numeric, () => void 0);
    const keys = inferredKeyValues(data, options.key, {
      groups: categoryValues,
      markId: id,
      warningIdentity: options
    });
    const rows = boxRows(data, {
      category: (_datum, { index }) => categoryValues[index],
      value: (_datum, { index }) => numericValues[index]
    });
    const summaries = rows.flatMap(
      (row) => row.kind === "summary" ? [{ ...row, markKey: `box:${valueKey(row.category)}` }] : []
    );
    const outliers = rows.flatMap((row) => {
      if (row.kind !== "outlier") return [];
      const sourceIndex = row.sourceIndexes[0];
      return [
        {
          ...row,
          markKey: `box:${valueKey(row.category)}:outlier:${valueKey(
            keys[sourceIndex]
          )}`
        }
      ];
    });
    const stroke = options.stroke ?? "currentColor";
    const children = orientation === "y" ? [
      link(summaries, {
        id: "whisker",
        x1: "category",
        y1: "whiskerLow",
        x2: "category",
        y2: "whiskerHigh",
        key: "markKey",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1,
        lineCap: "butt"
      }),
      barY(summaries, {
        id: "box",
        x: "category",
        y: "median",
        y1: "q1",
        y2: "q3",
        key: "markKey",
        fill: options.fill ?? "#ccc",
        fillOpacity: options.fillOpacity,
        inset: options.inset
      }),
      tickY(summaries, {
        id: "median",
        x: "category",
        y: "median",
        key: "markKey",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 2,
        inset: options.inset
      }),
      dot(outliers, {
        id: "outlier",
        x: "category",
        y: "value",
        key: "markKey",
        r: options.r ?? 3,
        fill: "none",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1.5
      })
    ] : [
      link(summaries, {
        id: "whisker",
        x1: "whiskerLow",
        y1: "category",
        x2: "whiskerHigh",
        y2: "category",
        key: "markKey",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1,
        lineCap: "butt"
      }),
      barX(summaries, {
        id: "box",
        x: "median",
        x1: "q1",
        x2: "q3",
        y: "category",
        key: "markKey",
        fill: options.fill ?? "#ccc",
        fillOpacity: options.fillOpacity,
        inset: options.inset
      }),
      tickX(summaries, {
        id: "median",
        x: "median",
        y: "category",
        key: "markKey",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 2,
        inset: options.inset
      }),
      dot(outliers, {
        id: "outlier",
        x: "value",
        y: "category",
        key: "markKey",
        r: options.r ?? 3,
        fill: "none",
        stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1.5
      })
    ];
    return initializeCompositeMark(id, children, {
      motion: options.motion,
      interactiveChildren: interactiveBoxChildren
    });
  });
}
function summarizeBoxes(data, categoryValues, numericValues) {
  const summaries = [];
  const outliers = [];
  for (const { key: category, indexes } of groupedIndexes(categoryValues)) {
    if (!isChartValue(category)) continue;
    const observations = indexes.flatMap((sourceIndex) => {
      const value = numericValues[sourceIndex];
      return typeof value === "number" && Number.isFinite(value) ? [{ sourceIndex, value }] : [];
    });
    if (!observations.length) continue;
    const sourceIndexes = observations.map(({ sourceIndex }) => sourceIndex);
    const ranked = [...observations].sort(
      (left, right) => left.value - right.value || left.sourceIndex - right.sourceIndex
    );
    const values = ranked.map(({ value }) => value);
    const q1 = quantileSortedValues(values, 0.25);
    const median = quantileSortedValues(values, 0.5);
    const q3 = quantileSortedValues(values, 0.75);
    const spread = q3 - q1;
    const lowerFence = q1 - spread * 1.5;
    const upperFence = q3 + spread * 1.5;
    const whiskerLow = ranked.find(({ value }) => value >= lowerFence)?.value ?? q1;
    let whiskerHigh = q3;
    for (let index = ranked.length - 1; index >= 0; index -= 1) {
      const candidate = ranked[index];
      if (!candidate || candidate.value > upperFence) continue;
      whiskerHigh = candidate.value;
      break;
    }
    summaries.push({
      kind: "summary",
      category,
      q1,
      median,
      q3,
      whiskerLow,
      whiskerHigh,
      count: sourceIndexes.length,
      source: sourceIndexes.map((index) => data[index]),
      sourceIndexes
    });
    for (const { sourceIndex, value } of observations) {
      if (value >= lowerFence && value <= upperFence) continue;
      outliers.push({
        kind: "outlier",
        category,
        value,
        source: [data[sourceIndex]],
        sourceIndexes: [sourceIndex]
      });
    }
  }
  outliers.sort((left, right) => left.sourceIndexes[0] - right.sourceIndexes[0]);
  return { summaries, outliers };
}
export {
  boxRows,
  boxX,
  boxY
};
