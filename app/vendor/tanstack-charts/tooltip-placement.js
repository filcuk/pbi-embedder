const defaultPlacements = [
  "top",
  "bottom",
  "right",
  "left"
];
function resolveChartTooltipPlacement(anchor, tooltip, boundary, placement, offset) {
  const edge = 8;
  const gap = offset !== void 0 && Number.isFinite(offset) ? Math.max(0, offset) : 10;
  const minimumLeft = boundary.left + edge;
  const minimumTop = boundary.top + edge;
  const maxLeft = Math.max(minimumLeft, boundary.right - edge - tooltip.width);
  const maxTop = Math.max(minimumTop, boundary.bottom - edge - tooltip.height);
  const placements = placement === void 0 || placement === "auto" ? defaultPlacements : Array.isArray(placement) ? placement.length ? placement : defaultPlacements : [placement];
  const candidates = placements.map(
    (candidate) => tooltipPlacement(
      candidate,
      anchor.x,
      anchor.y,
      tooltip.width,
      tooltip.height,
      gap
    )
  );
  let selected = candidates[0];
  let selectedOverflow = overflow(
    selected,
    tooltip.width,
    tooltip.height,
    boundary,
    edge
  );
  for (const candidate of candidates) {
    const candidateOverflow = overflow(
      candidate,
      tooltip.width,
      tooltip.height,
      boundary,
      edge
    );
    if (candidateOverflow === 0) {
      selected = candidate;
      break;
    }
    if (candidateOverflow < selectedOverflow) {
      selected = candidate;
      selectedOverflow = candidateOverflow;
    }
  }
  return {
    left: clamp(selected.left, minimumLeft, maxLeft),
    top: clamp(selected.top, minimumTop, maxTop),
    placement: selected.placement
  };
}
function tooltipPlacement(placement, anchorX, anchorY, width, height, gap) {
  const xDirection = placement.endsWith("right") || placement === "right" ? 1 : placement.endsWith("left") || placement === "left" ? -1 : 0;
  const yDirection = placement.startsWith("bottom") || placement === "bottom" ? 1 : placement.startsWith("top") || placement === "top" ? -1 : 0;
  return {
    placement,
    left: anchorX + (xDirection - 1) * width / 2 + xDirection * gap,
    top: anchorY + (yDirection - 1) * height / 2 + yDirection * gap
  };
}
function overflow(position, width, height, boundary, edge) {
  return Math.max(0, boundary.left + edge - position.left) + Math.max(0, position.left + width + edge - boundary.right) + Math.max(0, boundary.top + edge - position.top) + Math.max(0, position.top + height + edge - boundary.bottom);
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
export {
  resolveChartTooltipPlacement
};
