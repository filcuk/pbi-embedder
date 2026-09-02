import { allocateProportionalIntervals } from "./proportional-interval-internal.js";
import { toArray, transformKey, transformValues } from "./transform-internal.js";
function mosaicY(source, options) {
  return materializeMosaic(source, options, "y");
}
function mosaicX(source, options) {
  return materializeMosaic(source, options, "x");
}
function materializeMosaic(source, options, orientation) {
  const owner = orientation === "y" ? "mosaicY" : "mosaicX";
  const data = toArray(source);
  const xValues = transformValues(data, options.x);
  const yValues = transformValues(data, options.y);
  const values = transformValues(data, options.value);
  const rows = prepareRows(data, xValues, yValues, values, owner);
  const xCategories = orderedCategories(
    rows,
    (row) => row.xValue,
    options.xOrder,
    owner,
    "xOrder"
  );
  const yCategories = orderedCategories(
    rows,
    (row) => row.yValue,
    options.yOrder,
    owner,
    "yOrder"
  );
  const { coordinates, total } = allocateMosaic(
    rows,
    xCategories,
    yCategories,
    orientation
  );
  return rows.map((row) => {
    const position = coordinates.get(row.sourceIndex);
    const derived = {
      xValue: row.xValue,
      yValue: row.yValue,
      value: row.value,
      total,
      x: position.x,
      x1: position.x1,
      x2: position.x2,
      y: position.y,
      y1: position.y1,
      y2: position.y2,
      source: [row.datum],
      sourceIndexes: [row.sourceIndex]
    };
    return orientation === "y" ? { ...row.datum, ...derived, xTotal: position.outerTotal } : { ...row.datum, ...derived, yTotal: position.outerTotal };
  });
}
function prepareRows(data, xValues, yValues, values, owner) {
  const rows = [];
  const pairs = /* @__PURE__ */ new Map();
  data.forEach((datum, sourceIndex) => {
    const value = values[sourceIndex];
    if (!isFiniteNumber(value)) return;
    if (value < 0) {
      throw new TypeError(
        `${owner}: value at index ${sourceIndex} must be nonnegative`
      );
    }
    const xValue = xValues[sourceIndex];
    const yValue = yValues[sourceIndex];
    if (!isChartValue(xValue) || !isChartValue(yValue)) return;
    const xIdentity = transformKey(xValue);
    const yIdentity = transformKey(yValue);
    const pairIdentity = transformKey([xValue, yValue]);
    const previous = pairs.get(pairIdentity);
    if (previous !== void 0) {
      throw new TypeError(
        `${owner}: duplicate x/y pair ${formatCategory(xValue)} / ${formatCategory(yValue)} at indexes ${previous} and ${sourceIndex}; aggregate duplicate pairs before calling ${owner}`
      );
    }
    pairs.set(pairIdentity, sourceIndex);
    rows.push({
      datum,
      sourceIndex,
      xValue,
      yValue,
      xIdentity,
      yIdentity,
      value
    });
  });
  return rows;
}
function orderedCategories(rows, value, explicit, owner, option) {
  const categories = [];
  const seen = /* @__PURE__ */ new Set();
  explicit?.forEach((category, index) => {
    if (!isChartValue(category)) {
      throw new TypeError(
        `${owner}: ${option} category at index ${index} must be a string, finite number, or valid Date`
      );
    }
    const identity = transformKey(category);
    if (seen.has(identity)) {
      throw new TypeError(
        `${owner}: ${option} contains duplicate category ${formatCategory(category)}`
      );
    }
    seen.add(identity);
    categories.push({ identity, value: category });
  });
  for (const row of rows) {
    const category = value(row);
    const identity = transformKey(category);
    if (seen.has(identity)) continue;
    seen.add(identity);
    categories.push({ identity, value: category });
  }
  return categories;
}
function allocateMosaic(rows, xCategories, yCategories, orientation) {
  const outerCategories = orientation === "y" ? xCategories : yCategories;
  const innerCategories = orientation === "y" ? yCategories : xCategories;
  const innerRank = new Map(
    innerCategories.map((category, index) => [category.identity, index])
  );
  const outerIdentity = (row) => orientation === "y" ? row.xIdentity : row.yIdentity;
  const innerIdentity = (row) => orientation === "y" ? row.yIdentity : row.xIdentity;
  const rowsByOuter = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const outerKey = outerIdentity(row);
    let group = rowsByOuter.get(outerKey);
    if (!group) {
      group = /* @__PURE__ */ new Map();
      rowsByOuter.set(outerKey, group);
    }
    group.set(innerIdentity(row), row);
  }
  const outerRows = outerCategories.map(
    (category) => rowsByOuter.get(category.identity) ?? /* @__PURE__ */ new Map()
  );
  const rawOuterTotals = outerRows.map(
    (group) => sumValues([...group.values()].map((row) => row.value))
  );
  const outerWeights = overflowSafeGroupWeights(
    outerRows.map((group) => [...group.values()].map((row) => row.value)),
    rawOuterTotals
  );
  const outerIntervals = allocateProportionalIntervals(outerWeights);
  const total = sumValues(rows.map((row) => row.value));
  const coordinates = /* @__PURE__ */ new Map();
  outerRows.forEach((group, outerIndex) => {
    const outer = outerIntervals[outerIndex];
    if (!outer) return;
    const innerRows = [...group.values()].sort(
      (left, right) => (innerRank.get(innerIdentity(left)) ?? Number.MAX_SAFE_INTEGER) - (innerRank.get(innerIdentity(right)) ?? Number.MAX_SAFE_INTEGER)
    );
    const innerIntervals = allocateProportionalIntervals(
      innerRows.map((row) => row.value)
    );
    innerRows.forEach((row, innerIndex) => {
      const inner = innerIntervals[innerIndex];
      if (!inner) return;
      const outerCenter = midpoint(outer.start, outer.end);
      const innerCenter = midpoint(inner.start, inner.end);
      coordinates.set(
        row.sourceIndex,
        orientation === "y" ? {
          x: outerCenter,
          x1: outer.start,
          x2: outer.end,
          y: innerCenter,
          y1: inner.start,
          y2: inner.end,
          outerTotal: rawOuterTotals[outerIndex] ?? 0
        } : {
          x: innerCenter,
          x1: inner.start,
          x2: inner.end,
          y: outerCenter,
          y1: outer.start,
          y2: outer.end,
          outerTotal: rawOuterTotals[outerIndex] ?? 0
        }
      );
    });
  });
  return { coordinates, total };
}
function overflowSafeGroupWeights(groups, rawTotals) {
  if (rawTotals.every(Number.isFinite)) return [...rawTotals];
  let maximum = 0;
  for (const group of groups) {
    for (const value of group) maximum = Math.max(maximum, value);
  }
  if (maximum === 0) return rawTotals.map(() => 0);
  return groups.map(
    (group) => group.reduce((sum, value) => sum + value / maximum, 0)
  );
}
function sumValues(values) {
  return values.reduce((sum, value) => sum + value, 0);
}
function midpoint(start, end) {
  return start + (end - start) / 2;
}
function isChartValue(value) {
  return typeof value === "string" || isFiniteNumber(value) || value instanceof Date && Number.isFinite(value.getTime());
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function formatCategory(value) {
  return value instanceof Date ? value.toISOString() : JSON.stringify(value) ?? String(value);
}
export {
  mosaicX,
  mosaicY
};
