function detachSvgFocusGuideLayers(svg) {
  const layers = {};
  if (!svg) return layers;
  for (const placement of ["under", "over"]) {
    const layer = findSvgFocusGuideLayer(svg, placement);
    if (!layer) continue;
    layers[placement] = layer;
    layer.remove();
  }
  return layers;
}
function restoreSvgFocusGuideLayers(svg, layers, include = () => true) {
  for (const placement of ["under", "over"]) {
    const layer = layers[placement];
    if (layer && include(placement)) {
      placeSvgFocusGuideLayer(svg, layer, placement);
    }
  }
}
function ensureSvgFocusGuideLayer(svg, placement) {
  const existing = findSvgFocusGuideLayer(svg, placement);
  if (existing) return existing;
  const layer = svg.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  layer.dataset.tsKey = `focus-guide-layer:${placement}`;
  layer.dataset.tsFocusLayer = placement;
  layer.dataset.tsFocusGuideLayer = placement;
  layer.setAttribute(
    "class",
    `ts-chart__focus-guide-layer ts-chart__focus-guide-layer--${placement}`
  );
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("visibility", "hidden");
  placeSvgFocusGuideLayer(svg, layer, placement);
  return layer;
}
function removeSvgFocusGuideLayer(svg, placement) {
  findSvgFocusGuideLayer(svg, placement)?.remove();
}
function placeSvgFocusGuideLayer(svg, layer, placement) {
  if (placement === "under") {
    const scene = [...svg.children].find(
      (child) => child.getAttribute("data-ts-key") === "grid" || child.getAttribute("data-ts-key") === "marks" || child.classList.contains("ts-chart__grid") || child.classList.contains("ts-chart__marks")
    );
    svg.insertBefore(layer, scene ?? null);
  } else {
    svg.append(layer);
  }
}
function findSvgFocusGuideLayer(svg, placement) {
  return [...svg.children].find(
    (child) => child.localName === "g" && child.getAttribute("data-ts-focus-guide-layer") === placement
  );
}
export {
  detachSvgFocusGuideLayers,
  ensureSvgFocusGuideLayer,
  removeSvgFocusGuideLayer,
  restoreSvgFocusGuideLayers
};
