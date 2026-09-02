import {
  materializeGroups,
  orderedIndexes,
  toArray,
  transformValues
} from "./transform-internal.js";
function waterfall(source, options) {
  if (options.total === true) assertTotalGroupNames(options.by);
  const data = toArray(source);
  const values = transformValues(data, options.value);
  return materializeGroups(data, options.by).flatMap(({ group, indexes }) => {
    const validIndexes = indexes.filter(
      (index) => isFiniteNumber(values[index])
    );
    const ordered = orderedIndexes(
      data,
      validIndexes,
      options.orderBy,
      options.order
    );
    let cursor = 0;
    const steps = ordered.map((index) => {
      const datum = data[index];
      const delta = values[index];
      const start = cursor;
      const end = start + delta;
      if (!Number.isFinite(end)) {
        throw new TypeError(
          `waterfall: cumulative value at index ${index} must be finite`
        );
      }
      cursor = end;
      return {
        ...datum,
        delta,
        start,
        end,
        kind: delta >= 0 ? "increase" : "decrease",
        source: [datum],
        sourceIndexes: [index]
      };
    });
    if (options.total !== true || ordered.length === 0) return steps;
    const total = Object.assign({}, group, {
      delta: cursor,
      start: 0,
      end: cursor,
      kind: "total",
      source: ordered.map((index) => data[index]),
      sourceIndexes: ordered
    });
    return [...steps, total];
  });
}
const waterfallDerivedFields = /* @__PURE__ */ new Set([
  "delta",
  "start",
  "end",
  "kind",
  "source",
  "sourceIndexes"
]);
function assertTotalGroupNames(by) {
  if (by === void 0) return;
  const names = typeof by === "string" ? [by] : Object.keys(by);
  for (const name of names) {
    if (waterfallDerivedFields.has(name)) {
      throw new TypeError(
        `waterfall: group name "${name}" is reserved when total is true`
      );
    }
  }
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
export {
  waterfall
};
