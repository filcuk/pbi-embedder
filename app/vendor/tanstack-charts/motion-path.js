const coordinateTolerance = 0.05;
function resolveRollingPathPlan(previous, next, options) {
  const invalid = (reason) => ({
    kind: "fallback",
    fallback: options.fallback ?? "snap",
    reason
  });
  if (!previous.clipped || !next.clipped) return invalid("missing-clip");
  if (previous.kind !== next.kind) return invalid("path-kind-changed");
  if (Math.abs(previous.viewportTranslate.x) > 2e-3 || Math.abs(previous.viewportTranslate.y) > 2e-3 || Math.abs(next.viewportTranslate.x) > 2e-3 || Math.abs(next.viewportTranslate.y) > 2e-3) {
    return invalid("transient-viewport");
  }
  if (!sameBounds(previous.chart, next.chart)) {
    return invalid("plot-bounds-changed");
  }
  if (previous.customPath || next.customPath) return invalid("custom-path");
  const previousPoints = previous.points;
  const nextPoints = next.points;
  if (previousPoints.length !== nextPoints.length || previousPoints.length < 3) {
    return invalid("unbalanced-batch");
  }
  if (!uniquePointKeys(previousPoints) || !uniquePointKeys(nextPoints)) {
    return invalid("unstable-keys");
  }
  const batchSize = rollingBatchSize(previousPoints, nextPoints);
  if (batchSize === void 0) return invalid("noncontiguous-window");
  const retained = nextPoints.length - batchSize;
  if (retained < 2) return invalid("unbalanced-batch");
  const xShifts = [];
  const yPairs = [];
  for (let index = 0; index < retained; index += 1) {
    const prior = previousPoints[index + batchSize];
    const point = nextPoints[index];
    if (!prior || !point) return invalid("unbalanced-batch");
    if (!samePointSemantics(prior, point)) {
      return invalid("semantic-value-changed");
    }
    xShifts.push(prior.x - point.x);
    yPairs.push([point.y, prior.y]);
    for (const name of ["y1Value", "y2Value"]) {
      const value = point[name];
      if (value === void 0) continue;
      const nextY = safeMap(next.yScale, value);
      const previousY = safeMap(previous.yScale, value);
      if (nextY === void 0 || previousY === void 0) {
        return invalid("non-affine-y");
      }
      yPairs.push([nextY, previousY]);
    }
  }
  const x = xShifts[0] ?? 0;
  if (Math.abs(x) <= 2e-3 || xShifts.some((candidate) => !close(candidate, x))) {
    return invalid("nonuniform-x-shift");
  }
  const y = options.y === "reproject" ? fitAffine(yPairs) : yPairs.every(([nextY, previousY]) => close(nextY, previousY)) ? { scale: 1, translate: 0 } : void 0;
  if (!y) {
    return invalid(
      options.y === "reproject" ? "non-affine-y" : "fixed-y-changed"
    );
  }
  const xs = next.geometry.map((point) => point[0]);
  const minimum = Math.min(...xs);
  const maximum = Math.max(...xs);
  const left = next.chart.x;
  const right = left + next.chart.width;
  const covered = Number.isFinite(minimum) && Number.isFinite(maximum) && (x > 0 ? minimum + x <= left + coordinateTolerance && maximum >= right - coordinateTolerance : maximum + x >= right - coordinateTolerance && minimum <= left + coordinateTolerance);
  if (!covered) return invalid("insufficient-coverage");
  return {
    kind: "transform",
    batchSize,
    transform: { x, yScale: y.scale, y: y.translate }
  };
}
function rollingBatchSize(previous, next) {
  for (let batchSize = 1; batchSize < previous.length; batchSize += 1) {
    const retained = previous.length - batchSize;
    let matches = true;
    for (let index = 0; index < retained; index += 1) {
      if (previous[index + batchSize]?.key !== next[index]?.key) {
        matches = false;
        break;
      }
    }
    if (matches) return batchSize;
  }
  return void 0;
}
function samePointSemantics(previous, next) {
  if (previous.markId !== next.markId || !sameValue(previous.group, next.group)) {
    return false;
  }
  for (const name of [
    "xValue",
    "yValue",
    "x1Value",
    "x2Value",
    "y1Value",
    "y2Value"
  ]) {
    if (!sameValue(previous[name], next[name])) return false;
  }
  return true;
}
function sameValue(previous, next) {
  if (previous instanceof Date && next instanceof Date) {
    return previous.getTime() === next.getTime();
  }
  return Object.is(previous, next);
}
function uniquePointKeys(points) {
  return new Set(points.map((point) => point.key)).size === points.length;
}
function safeMap(scale, value) {
  try {
    const mapped = scale.map(value);
    return Number.isFinite(mapped) ? mapped : void 0;
  } catch {
    return void 0;
  }
}
function fitAffine(pairs) {
  const first = pairs[0];
  if (!first) return void 0;
  let second;
  for (const pair of pairs) {
    if (Math.abs(pair[0] - first[0]) > coordinateTolerance) {
      second = pair;
      break;
    }
  }
  const scale = second ? (second[1] - first[1]) / (second[0] - first[0]) : 1;
  const translate = first[1] - scale * first[0];
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(translate)) {
    return void 0;
  }
  return pairs.every(
    ([next, previous]) => close(scale * next + translate, previous)
  ) ? { scale, translate } : void 0;
}
function sameBounds(previous, next) {
  return close(previous.x, next.x) && close(previous.y, next.y) && close(previous.width, next.width) && close(previous.height, next.height);
}
function close(left, right) {
  return Math.abs(left - right) <= coordinateTolerance;
}
export {
  resolveRollingPathPlan
};
