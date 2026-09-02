import { areaY } from "./area.js";
import { areaX } from "./area-x.js";
import { lineX, lineY } from "./line.js";
import { channelValues, createMark, isChartKey, isFiniteNumber } from "./mark.js";
import { initializeCompositeMark } from "./mark-composite-internal.js";
import { valueKey } from "./scales.js";
import { groupedIndexes, toArray, transformValues } from "./transform-internal.js";
const interactiveRegressionChildren = /* @__PURE__ */ new Set(["line"]);
function linearRegressionRowsY(source, options) {
  const data = toArray(source);
  const normalized = normalizeRegressionOptions(
    options,
    "linearRegressionRowsY"
  );
  return regressionRowsYFromValues(
    data,
    transformValues(data, options.x),
    transformValues(data, options.y),
    options.z === void 0 ? data.map(() => null) : transformValues(data, options.z),
    normalized,
    "linearRegressionRowsY"
  );
}
function linearRegressionRowsX(source, options) {
  const data = toArray(source);
  const normalized = normalizeRegressionOptions(
    options,
    "linearRegressionRowsX"
  );
  return regressionRowsXFromValues(
    data,
    transformValues(data, options.y),
    transformValues(data, options.x),
    options.z === void 0 ? data.map(() => null) : transformValues(data, options.z),
    normalized,
    "linearRegressionRowsX"
  );
}
function linearRegressionY(source, options) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `linear-regression-y-${markIndex}`;
    const normalized = normalizeRegressionOptions(options, "linearRegressionY");
    const independentValues = channelValues(data, options.x, () => void 0);
    const dependentValues = channelValues(data, options.y, () => void 0);
    const groups = channelValues(data, options.z, () => null);
    const semanticRows = linearRegressionRowsY(data, {
      x: (_datum, { index }) => independentValues[index],
      y: (_datum, { index }) => dependentValues[index],
      z: (_datum, { index }) => groups[index],
      ...normalized
    });
    const rows = withRegressionMarkKeys(semanticRows);
    const children = [
      ...normalized.ci === 0 ? [] : [
        areaY(rows, {
          id: "band",
          x: "x",
          y: "y",
          y1: "y1",
          y2: "y2",
          z: "group",
          key: "markKey",
          fill: options.fill ?? options.stroke,
          fillOpacity: options.fillOpacity ?? 0.1
        })
      ],
      lineY(rows, {
        id: "line",
        x: "x",
        y: "y",
        z: "group",
        key: "markKey",
        stroke: options.stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1.5,
        strokeDasharray: options.strokeDasharray
      })
    ];
    return initializeCompositeMark(id, children, {
      motion: options.motion,
      interactiveChildren: interactiveRegressionChildren
    });
  });
}
function linearRegressionX(source, options) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `linear-regression-x-${markIndex}`;
    const normalized = normalizeRegressionOptions(options, "linearRegressionX");
    const independentValues = channelValues(data, options.y, () => void 0);
    const dependentValues = channelValues(data, options.x, () => void 0);
    const groups = channelValues(data, options.z, () => null);
    const semanticRows = linearRegressionRowsX(data, {
      x: (_datum, { index }) => dependentValues[index],
      y: (_datum, { index }) => independentValues[index],
      z: (_datum, { index }) => groups[index],
      ...normalized
    });
    const rows = withRegressionMarkKeys(semanticRows);
    const children = [
      ...normalized.ci === 0 ? [] : [
        areaX(rows, {
          id: "band",
          x: "x",
          x1: "x1",
          x2: "x2",
          y: "y",
          z: "group",
          key: "markKey",
          fill: options.fill ?? options.stroke,
          fillOpacity: options.fillOpacity ?? 0.1
        })
      ],
      lineX(rows, {
        id: "line",
        x: "x",
        y: "y",
        z: "group",
        key: "markKey",
        stroke: options.stroke,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth ?? 1.5,
        strokeDasharray: options.strokeDasharray
      })
    ];
    return initializeCompositeMark(id, children, {
      motion: options.motion,
      interactiveChildren: interactiveRegressionChildren
    });
  });
}
function normalizeRegressionOptions(options, owner) {
  const ci = options.ci ?? 0.95;
  const samples = options.samples ?? 64;
  if (!Number.isFinite(ci) || ci < 0 || ci >= 1) {
    throw new TypeError(`${owner}: ci must be a finite number in [0, 1)`);
  }
  if (!Number.isInteger(samples) || samples < 2) {
    throw new TypeError(`${owner}: samples must be an integer of at least 2`);
  }
  return { ci, samples };
}
function regressionRowsYFromValues(data, independentValues, dependentValues, groups, options, owner) {
  return regressionSamples(
    data,
    independentValues,
    dependentValues,
    groups,
    options,
    owner
  ).map((sample) => ({
    x: sample.independent,
    y: sample.predicted,
    ...sample.lower === void 0 ? {} : { y1: sample.lower },
    ...sample.upper === void 0 ? {} : { y2: sample.upper },
    group: sample.group,
    source: sample.source,
    sourceIndexes: sample.sourceIndexes
  }));
}
function regressionRowsXFromValues(data, independentValues, dependentValues, groups, options, owner) {
  return regressionSamples(
    data,
    independentValues,
    dependentValues,
    groups,
    options,
    owner
  ).map((sample) => ({
    x: sample.predicted,
    ...sample.lower === void 0 ? {} : { x1: sample.lower },
    ...sample.upper === void 0 ? {} : { x2: sample.upper },
    y: sample.independent,
    group: sample.group,
    source: sample.source,
    sourceIndexes: sample.sourceIndexes
  }));
}
function withRegressionMarkKeys(rows) {
  const groupIndexes = /* @__PURE__ */ new Map();
  return rows.map((row) => {
    const groupKey = valueKey(row.group);
    const sampleIndex = groupIndexes.get(groupKey) ?? 0;
    groupIndexes.set(groupKey, sampleIndex + 1);
    return { ...row, markKey: `${groupKey}:${sampleIndex}` };
  });
}
function regressionSamples(data, independentValues, dependentValues, rawGroups, options, owner) {
  const groups = rawGroups.map((group) => isChartKey(group) ? group : null);
  const independentKind = validateIndependentKind(
    independentValues,
    dependentValues,
    owner
  );
  return groupedIndexes(groups).flatMap(({ key: group, indexes }) => {
    const observations = indexes.flatMap((sourceIndex) => {
      const independent = numericIndependent(independentValues[sourceIndex]);
      const dependent = dependentValues[sourceIndex];
      return independent !== void 0 && isFiniteNumber(dependent) ? [{ sourceIndex, independent, dependent }] : [];
    });
    if (observations.length < 2) return [];
    const fit = fitRegression(observations, options.ci);
    if (fit === void 0) return [];
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    observations.forEach(({ independent }) => {
      minimum = Math.min(minimum, independent);
      maximum = Math.max(maximum, independent);
    });
    const sourceIndexes = observations.map(({ sourceIndex }) => sourceIndex);
    const lineageSource = sourceIndexes.map((index) => data[index]);
    return Array.from({ length: options.samples }, (_value, sampleIndex) => {
      const independent = sampleIndex === 0 ? minimum : sampleIndex === options.samples - 1 ? maximum : minimum + (maximum - minimum) * sampleIndex / (options.samples - 1);
      const predicted = predictRegression(fit, independent);
      if (!Number.isFinite(predicted)) {
        throw new TypeError(`${owner}: fitted values must be finite`);
      }
      const halfWidth = confidenceHalfWidth(fit, independent);
      const lower = halfWidth === void 0 ? void 0 : predicted - halfWidth;
      const upper = halfWidth === void 0 ? void 0 : predicted + halfWidth;
      if (lower !== void 0 && !Number.isFinite(lower) || upper !== void 0 && !Number.isFinite(upper)) {
        throw new TypeError(`${owner}: confidence values must be finite`);
      }
      return {
        independent: independentKind === "date" ? new Date(independent) : independent,
        predicted,
        ...lower === void 0 ? {} : { lower },
        ...upper === void 0 ? {} : { upper },
        group,
        source: lineageSource,
        sourceIndexes
      };
    });
  });
}
function validateIndependentKind(independentValues, dependentValues, owner) {
  let kind;
  independentValues.forEach((value, index) => {
    if (numericIndependent(value) === void 0) return;
    if (!isFiniteNumber(dependentValues[index])) return;
    const next = value instanceof Date ? "date" : "number";
    if (kind !== void 0 && kind !== next) {
      throw new TypeError(
        `${owner}: independent values must be uniformly numbers or Dates`
      );
    }
    kind = next;
  });
  return kind ?? "number";
}
function numericIndependent(value) {
  if (isFiniteNumber(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  return void 0;
}
function fitRegression(observations, ci) {
  let meanIndependent = 0;
  let meanDependent = 0;
  let sumIndependentSquares = 0;
  let sumProducts = 0;
  observations.forEach(({ independent, dependent }, index) => {
    const count = index + 1;
    const independentDelta = independent - meanIndependent;
    const dependentDelta = dependent - meanDependent;
    meanIndependent += independentDelta / count;
    meanDependent += dependentDelta / count;
    sumIndependentSquares += independentDelta * (independent - meanIndependent);
    sumProducts += independentDelta * (dependent - meanDependent);
  });
  if (!Number.isFinite(sumIndependentSquares) || sumIndependentSquares <= 0) {
    return void 0;
  }
  const slope = sumProducts / sumIndependentSquares;
  if (!Number.isFinite(slope)) return void 0;
  const residualDegrees = observations.length - 2;
  if (ci === 0 || residualDegrees <= 0) {
    return {
      count: observations.length,
      meanIndependent,
      meanDependent,
      sumIndependentSquares,
      slope
    };
  }
  let residualSquares = 0;
  observations.forEach(({ independent, dependent }) => {
    const residual = dependent - (meanDependent + slope * (independent - meanIndependent));
    residualSquares += residual * residual;
  });
  const residualStandardError = Math.sqrt(
    Math.max(0, residualSquares) / residualDegrees
  );
  const criticalValue = inverseStudentT((1 + ci) / 2, residualDegrees);
  if (!Number.isFinite(residualStandardError) || !Number.isFinite(criticalValue)) {
    return void 0;
  }
  return {
    count: observations.length,
    meanIndependent,
    meanDependent,
    sumIndependentSquares,
    slope,
    residualStandardError,
    criticalValue
  };
}
function predictRegression(fit, independent) {
  return fit.meanDependent + fit.slope * (independent - fit.meanIndependent);
}
function confidenceHalfWidth(fit, independent) {
  if (fit.residualStandardError === void 0 || fit.criticalValue === void 0) {
    return void 0;
  }
  const centered = independent - fit.meanIndependent;
  const standardError = fit.residualStandardError * Math.sqrt(1 / fit.count + centered * centered / fit.sumIndependentSquares);
  return fit.criticalValue * standardError;
}
function inverseStudentT(probability, degreesOfFreedom) {
  if (probability === 0.5) return 0;
  const sign = probability < 0.5 ? -1 : 1;
  const target = probability < 0.5 ? 1 - probability : probability;
  let low = 0;
  let high = 1;
  while (studentTCdf(high, degreesOfFreedom) < target) high *= 2;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    if (studentTCdf(middle, degreesOfFreedom) < target) low = middle;
    else high = middle;
  }
  return sign * ((low + high) / 2);
}
function studentTCdf(value, degreesOfFreedom) {
  const ratio = degreesOfFreedom / (degreesOfFreedom + value * value);
  const tail = regularizedIncompleteBeta(ratio, degreesOfFreedom / 2, 0.5) / 2;
  return value >= 0 ? 1 - tail : tail;
}
function regularizedIncompleteBeta(value, alpha, beta) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  const factor = Math.exp(
    logGamma(alpha + beta) - logGamma(alpha) - logGamma(beta) + alpha * Math.log(value) + beta * Math.log1p(-value)
  );
  return value < (alpha + 1) / (alpha + beta + 2) ? factor * betaContinuedFraction(value, alpha, beta) / alpha : 1 - factor * betaContinuedFraction(1 - value, beta, alpha) / beta;
}
function betaContinuedFraction(value, alpha, beta) {
  const floor = 1e-30;
  const sum = alpha + beta;
  const alphaPlus = alpha + 1;
  const alphaMinus = alpha - 1;
  let c = 1;
  let d = 1 - sum * value / alphaPlus;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= 200; iteration += 1) {
    const doubled = iteration * 2;
    let numerator = iteration * (beta - iteration) * value / ((alphaMinus + doubled) * (alpha + doubled));
    d = 1 + numerator * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + numerator / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    result *= d * c;
    numerator = -(alpha + iteration) * (sum + iteration) * value / ((alpha + doubled) * (alphaPlus + doubled));
    d = 1 + numerator * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + numerator / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const change = d * c;
    result *= change;
    if (Math.abs(change - 1) < 3e-12) break;
  }
  return result;
}
function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9984369578019572e-21,
    15056327351493116e-23
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let series = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => {
    series += coefficient / (shifted + index + 1);
  });
  const total = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(total) - total + Math.log(series);
}
export {
  linearRegressionRowsX,
  linearRegressionRowsY,
  linearRegressionX,
  linearRegressionY
};
