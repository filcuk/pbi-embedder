import {
  stack as d3Stack,
  stackOffsetDiverging,
  stackOffsetExpand,
  stackOffsetNone,
  stackOffsetSilhouette,
  stackOffsetWiggle,
  stackOrderInsideOut
} from "d3-shape";
import { valueKey } from "./scales.js";
function stackExtents(input, options = {}) {
  const anchorFraction = resolveAnchorFraction(options);
  if (input.length === 0) return /* @__PURE__ */ new Map();
  const positions = [];
  const positionIndex = /* @__PURE__ */ new Map();
  const seriesInput = [];
  const seriesSeen = /* @__PURE__ */ new Set();
  for (const row of input) {
    const positionIdentity = valueKey(row.position);
    if (!positionIndex.has(positionIdentity)) {
      positionIndex.set(positionIdentity, positions.length);
      positions.push(row.position);
    }
    const seriesIdentity = valueKey(row.series);
    if (!seriesSeen.has(seriesIdentity)) {
      seriesSeen.add(seriesIdentity);
      seriesInput.push(row.series);
    }
  }
  const rows = positions.map(
    () => /* @__PURE__ */ Object.create(null)
  );
  const sourceIndices = /* @__PURE__ */ new Map();
  for (const row of input) {
    const position = positionIndex.get(valueKey(row.position));
    const seriesIdentity = valueKey(row.series);
    const identity = `${position}:${seriesIdentity}`;
    if (sourceIndices.has(identity)) {
      throw new TypeError(
        `A stack requires at most one value for each position and series; duplicate ${String(row.position)} / ${String(row.series)}`
      );
    }
    sourceIndices.set(identity, row.index);
    rows[position][seriesIdentity] = row.value;
  }
  const insideOut = options.order === "inside-out";
  if (anchorFraction !== void 0 && input.some(({ value }) => value < 0)) {
    throw new TypeError("A stack anchor requires nonnegative values");
  }
  const series = orderedSeries(input, seriesInput, options.order);
  if (options.reverse && !insideOut) series.reverse();
  const identities = series.map(valueKey);
  const offset = options.anchor ? stackOffsetNone : options.offset === "normalize" ? stackOffsetExpand : options.offset === "center" ? stackOffsetSilhouette : options.offset === "wiggle" ? stackOffsetWiggle : stackOffsetDiverging;
  const generator = d3Stack().keys(identities).value((row, key) => row[key] ?? 0).offset(offset);
  if (insideOut) {
    generator.order(
      options.reverse ? (seriesValues) => stackOrderInsideOut(seriesValues).reverse() : stackOrderInsideOut
    );
  }
  const stacked = generator(rows);
  if (options.anchor && anchorFraction !== void 0) {
    translateAnchorToZero(stacked, options.anchor.series, anchorFraction);
  }
  if (options.offset === "wiggle") translateWiggleToZero(stacked);
  const output = /* @__PURE__ */ new Map();
  stacked.forEach((seriesValues) => {
    const seriesIdentity = seriesValues.key;
    seriesValues.forEach((extent, position) => {
      const sourceIndex = sourceIndices.get(`${position}:${seriesIdentity}`);
      if (sourceIndex === void 0) return;
      output.set(sourceIndex, { start: extent[0], end: extent[1] });
    });
  });
  return output;
}
function resolveAnchorFraction(options) {
  const anchor = options.anchor;
  if (!anchor) return void 0;
  if (options.offset !== void 0 && options.offset !== "diverging") {
    throw new TypeError(
      "A stack anchor can only be used with the diverging offset"
    );
  }
  const fraction = anchor.fraction ?? 0.5;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new TypeError("A stack anchor fraction must be between zero and one");
  }
  return fraction;
}
function translateAnchorToZero(stacked, series, fraction) {
  const anchorIdentity = valueKey(series);
  const anchorSeries = stacked.find(
    (seriesValues) => seriesValues.key === anchorIdentity
  );
  if (!anchorSeries) {
    throw new TypeError(
      `Stack anchor series "${String(series)}" is not in the resolved series order`
    );
  }
  anchorSeries.forEach((anchorExtent, position) => {
    const shift = anchorExtent[0] + (anchorExtent[1] - anchorExtent[0]) * fraction;
    for (const seriesValues of stacked) {
      const extent = seriesValues[position];
      if (!extent) continue;
      extent[0] -= shift;
      extent[1] -= shift;
    }
  });
}
function translateWiggleToZero(stacked) {
  let baseline = Number.POSITIVE_INFINITY;
  for (const series of stacked) {
    for (const extent of series) baseline = Math.min(baseline, extent[0]);
  }
  if (!Number.isFinite(baseline) || baseline === 0) return;
  for (const series of stacked) {
    for (const extent of series) {
      extent[0] -= baseline;
      extent[1] -= baseline;
    }
  }
}
function stackValues(positions, values, series, options = {}, fallbackSeries = "value") {
  const input = [];
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    const value = values[index];
    if (!isChartValue(position) || !isFiniteNumber(value)) continue;
    const seriesValue = series[index];
    input.push({
      index,
      position,
      value,
      series: isChartKey(seriesValue) ? seriesValue : fallbackSeries === "index" ? index : "value"
    });
  }
  const extents = stackExtents(input, options);
  const starts = Array.from(
    { length: positions.length },
    () => void 0
  );
  const ends = Array.from(
    { length: positions.length },
    () => void 0
  );
  for (const [index, extent] of extents) {
    starts[index] = extent.start;
    ends[index] = extent.end;
  }
  return { starts, ends };
}
function isChartKey(value) {
  return typeof value === "string" || typeof value === "number";
}
function isChartValue(value) {
  return typeof value === "string" || isFiniteNumber(value) || value instanceof Date && Number.isFinite(value.getTime());
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function orderedSeries(rows, input, order) {
  if (Array.isArray(order)) {
    const explicit = [...order];
    const explicitKeys = new Set(explicit.map(valueKey));
    return [
      ...explicit,
      ...input.filter((value) => !explicitKeys.has(valueKey(value)))
    ];
  }
  if (order !== "ascending" && order !== "descending") return [...input];
  const totals = new Map(input.map((value) => [valueKey(value), 0]));
  for (const row of rows) {
    const key = valueKey(row.series);
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(row.value));
  }
  return [...input].sort((left, right) => {
    const difference = (totals.get(valueKey(left)) ?? 0) - (totals.get(valueKey(right)) ?? 0);
    return order === "ascending" ? difference : -difference;
  });
}
export {
  stackExtents,
  stackValues
};
