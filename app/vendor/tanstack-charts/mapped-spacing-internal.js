import { isChartValue } from "./mark.js";
function minimumMappedSpacing(scale, values) {
  const positions = [
    ...new Set(
      values.filter(isChartValue).map(scale.map).filter((value) => Number.isFinite(value))
    )
  ].sort((left, right) => left - right);
  let minimum = Infinity;
  for (let index = 1; index < positions.length; index += 1) {
    const distance = positions[index] - positions[index - 1];
    if (distance > 0) minimum = Math.min(minimum, distance);
  }
  return Number.isFinite(minimum) ? minimum : void 0;
}
function resolvedCategoryStep(scale, plotSpan, fitUnits = 1) {
  const spacing = minimumMappedSpacing(scale, scale.domain);
  if (spacing !== void 0) return spacing;
  const fitted = plotSpan / Math.max(1, fitUnits);
  return scale.bandwidth > 0 ? Math.min(scale.bandwidth, fitted) : fitted;
}
function isResolvedCategoryScale(scale) {
  return scale?.type === "band" || scale?.type === "point";
}
export {
  isResolvedCategoryScale,
  minimumMappedSpacing,
  resolvedCategoryStep
};
