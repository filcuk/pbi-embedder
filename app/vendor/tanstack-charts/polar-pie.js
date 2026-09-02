import { orderedIndexes, toArray, transformValues } from "./transform-internal.js";
import { allocateProportionalIntervals } from "./proportional-interval-internal.js";
const tau = Math.PI * 2;
const fullRevolutionTolerance = 1e-12;
function pie(source, options) {
  const data = toArray(source);
  const values = transformValues(data, options.value);
  const startAngle = options.startAngle ?? 0;
  const endAngle = options.endAngle ?? tau;
  const gapAngle = options.gapAngle ?? 0;
  assertFinite(startAngle, "startAngle");
  assertFinite(endAngle, "endAngle");
  assertNonnegativeFinite(gapAngle, "gapAngle");
  const sweep = endAngle - startAngle;
  if (!Number.isFinite(sweep) || Math.abs(sweep) > tau) {
    throw new TypeError("pie: angular sweep must be no greater than 2\u03C0");
  }
  const sourceIndexes = values.flatMap((value, sourceIndex) => {
    if (!isFiniteNumber(value)) return [];
    if (value < 0) {
      throw new TypeError(
        `pie: value at index ${sourceIndex} must be nonnegative`
      );
    }
    return [sourceIndex];
  });
  const ordered = orderedIndexes(
    data,
    sourceIndexes,
    options.orderBy,
    options.order
  );
  const completeRevolution = Math.abs(Math.abs(sweep) - tau) <= fullRevolutionTolerance;
  assertPieGapCapacity(ordered, values, sweep, gapAngle, completeRevolution);
  const allocated = allocateProportionalIntervals(
    ordered.map((sourceIndex) => values[sourceIndex]),
    {
      start: startAngle,
      end: endAngle,
      gap: gapAngle,
      gapAfterLast: completeRevolution
    }
  );
  const intervals = /* @__PURE__ */ new Map();
  ordered.forEach((sourceIndex, index) => {
    const interval = allocated[index];
    const value = values[sourceIndex];
    intervals.set(sourceIndex, {
      value,
      index,
      fraction: interval.fraction,
      startAngle: interval.start,
      endAngle: interval.end,
      angle: interval.start + (interval.end - interval.start) / 2,
      padAngle: 0
    });
  });
  return sourceIndexes.map((sourceIndex) => {
    const datum = data[sourceIndex];
    return {
      ...datum,
      ...intervals.get(sourceIndex),
      source: [datum],
      sourceIndexes: [sourceIndex]
    };
  });
}
function assertPieGapCapacity(ordered, values, sweep, gapAngle, completeRevolution) {
  const positiveCount = ordered.reduce(
    (count, sourceIndex) => count + (values[sourceIndex] > 0 ? 1 : 0),
    0
  );
  const absoluteSweep = Math.abs(sweep);
  const gapCount = positiveCount === 0 ? 0 : completeRevolution ? positiveCount : Math.max(0, positiveCount - 1);
  const totalGap = gapCount * gapAngle;
  if (!Number.isFinite(totalGap) || totalGap > absoluteSweep) {
    throw new TypeError("pie: gapAngle leaves insufficient angular space");
  }
  const drawableSweep = absoluteSweep - totalGap;
  if (positiveCount > 0 && drawableSweep <= 0) {
    throw new TypeError("pie: positive values require drawable angular space");
  }
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function assertFinite(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`pie: ${name} must be finite`);
  }
}
function assertNonnegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`pie: ${name} must be nonnegative and finite`);
  }
}
export {
  pie
};
