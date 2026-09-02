import {
  resolveChartTooltipPlacement
} from "./tooltip-placement.js";
import {
  resolveChartTooltipPlacement as resolveChartTooltipPlacement2
} from "./tooltip-placement.js";
function placeTooltip(tooltip, anchorX, anchorY, boundary, placement, offset) {
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const resolved = resolveChartTooltipPlacement(
    { x: anchorX, y: anchorY },
    { width, height },
    boundary,
    placement,
    offset
  );
  tooltip.style.left = `${resolved.left}px`;
  tooltip.style.top = `${resolved.top}px`;
  tooltip.dataset.placement = resolved.placement;
}
function sceneToClient(element, width, height, position) {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !width || !height) return null;
  return {
    x: bounds.left + position.x / width * bounds.width,
    y: bounds.top + position.y / height * bounds.height
  };
}
function viewportBounds(document) {
  const view = document.defaultView;
  const visualViewport = view?.visualViewport;
  const left = visualViewport?.offsetLeft ?? 0;
  const top = visualViewport?.offsetTop ?? 0;
  const width = visualViewport?.width || document.documentElement.clientWidth || view?.innerWidth || 0;
  const height = visualViewport?.height || document.documentElement.clientHeight || view?.innerHeight || 0;
  return { left, top, right: left + width, bottom: top + height };
}
function pointInBounds(point, bounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}
export {
  placeTooltip,
  pointInBounds,
  resolveChartTooltipPlacement2 as resolveChartTooltipPlacement,
  sceneToClient,
  viewportBounds
};
