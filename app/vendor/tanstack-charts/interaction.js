import { focusNearestX, focusNearestY, focusGroupX, focusGroupY } from "./focus.js";
import { findContainingScenePoint } from "./nearest.js";
function resolveChartFocusStrategy(focus) {
  if (focus === false) return void 0;
  if (typeof focus !== "string") return focus;
  switch (focus) {
    case "nearest-x":
      return focusNearestX;
    case "nearest-y":
      return focusNearestY;
    case "group-x":
      return focusGroupX;
    case "group-y":
      return focusGroupY;
    case "nearest":
      return void 0;
  }
}
function resolveChartPointerFocus(scene, focusMode, x, y, maxDistance, points = scene.points) {
  const strategy = resolveChartFocusStrategy(focusMode);
  if (!strategy) return void 0;
  if (points === scene.points && (strategy === focusNearestX || strategy === focusNearestY || strategy === focusGroupX || strategy === focusGroupY)) {
    const contained = findContainingScenePoint(scene, x, y);
    if (contained) {
      return contained.point ? strategy.group(points, { point: contained.point }) : [];
    }
  }
  return strategy.resolve(points, { x, y, maxDistance });
}
function sameChartPointIdentity(left, right) {
  return left === right || left !== null && right !== null && left.key === right.key && left.markId === right.markId && left.datumIndex === right.datumIndex;
}
function restoreChartFocusPoint(points, previous) {
  const matches = points.filter((point) => point.key === previous.key);
  if (matches.length < 2) return matches[0] ?? null;
  const datumType = typeof previous.datum;
  const hasReferenceIdentity = previous.datum !== null && (datumType === "object" || datumType === "function");
  if (hasReferenceIdentity) {
    const sameDatum = matches.find((point) => point.datum === previous.datum);
    if (sameDatum) return sameDatum;
  }
  return matches.find(
    (point) => point.markId === previous.markId && Object.is(point.group, previous.group) && sameChartValue(point.xValue, previous.xValue) && sameChartValue(point.yValue, previous.yValue)
  ) ?? matches.find(
    (point) => point.markId === previous.markId && point.datumIndex === previous.datumIndex
  ) ?? matches[0] ?? null;
}
function chartPointFromNavigationOrder(points, current, key) {
  const currentIndex = current ? points.findIndex((point) => sameChartPointIdentity(point, current)) : -1;
  let nextIndex;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = Math.min(points.length - 1, currentIndex + 1);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = points.length - 1;
      break;
    default:
      return void 0;
  }
  return points[nextIndex] ?? null;
}
function chartPointFromSceneOrder(points, current, key) {
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : key === "Home" ? 0 : key === "End" ? 2 : void 0;
  if (direction === void 0) return void 0;
  if (!points.length) return null;
  const currentIndex = current ? points.findIndex((point) => sameChartPointIdentity(point, current)) : -1;
  if (!current || currentIndex < 0 || direction === 0 || direction === 2) {
    return navigationExtreme(points, direction === 2);
  }
  let candidate = null;
  let candidateIndex = -1;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    const relative = compareNavigationPoints(
      point,
      index,
      current,
      currentIndex
    );
    if (direction > 0 && relative <= 0 || direction < 0 && relative >= 0) {
      continue;
    }
    if (!candidate || direction * compareNavigationPoints(point, index, candidate, candidateIndex) < 0) {
      candidate = point;
      candidateIndex = index;
    }
  }
  return candidate ?? current;
}
function navigationExtreme(points, maximum) {
  let candidate = points[0] ?? null;
  let candidateIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point || !candidate) continue;
    const comparison = compareNavigationPoints(
      point,
      index,
      candidate,
      candidateIndex
    );
    if (maximum && comparison > 0 || !maximum && comparison < 0) {
      candidate = point;
      candidateIndex = index;
    }
  }
  return candidate;
}
function compareNavigationPoints(left, leftIndex, right, rightIndex) {
  return left.x - right.x || left.y - right.y || leftIndex - rightIndex;
}
function sameChartValue(left, right) {
  return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : Object.is(left, right);
}
export {
  chartPointFromNavigationOrder,
  chartPointFromSceneOrder,
  resolveChartFocusStrategy,
  resolveChartPointerFocus,
  restoreChartFocusPoint,
  sameChartPointIdentity
};
