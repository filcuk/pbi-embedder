import { renderFocusGuideLayer } from "./svg-renderer.js";
function renderFocusGuideLayerWithRenderer(svg, scene, nodes, placement, options, renderSvg) {
  const document = svg.ownerDocument;
  const key = `focus-guide-layer:${placement}`;
  const wrapper = {
    kind: "group",
    key,
    className: `ts-chart__focus-guide-layer ts-chart__focus-guide-layer--${placement}`,
    ariaHidden: true,
    children: nodes
  };
  const markup = renderSvg(
    {
      ...scene,
      nodes: [wrapper],
      focusGuides: void 0
    },
    options
  );
  const root = parseSvgMarkup(document, markup);
  const layer = root ? keyedElement(root, key) : void 0;
  if (!root || !layer || layer.localName !== "g") {
    throw new Error(
      `The SVG renderer must preserve a g[data-ts-key="${key}"] element when serializing focus guides.`
    );
  }
  layer.classList.add(
    "ts-chart__focus-guide-layer",
    `ts-chart__focus-guide-layer--${placement}`
  );
  layer.setAttribute("data-ts-focus-layer", placement);
  layer.setAttribute("data-ts-focus-guide-layer", placement);
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("visibility", nodes.length ? "visible" : "hidden");
  mergeFocusGuideClipFallback(
    document,
    layer,
    nodes,
    placement,
    options.idPrefix ?? ""
  );
  copyMissingRendererDefinitions(svg, root, layer, key);
  return layer.outerHTML;
}
function mergeFocusGuideClipFallback(document, layer, nodes, placement, idPrefix) {
  const fallback = parseSvgFragment(
    document,
    renderFocusGuideLayer(nodes, placement, idPrefix)
  );
  if (!fallback) return;
  for (const source of keyedElements(fallback)) {
    const clipPath = source.getAttribute("clip-path");
    const key = source.getAttribute("data-ts-key");
    if (!clipPath || !key) continue;
    const target = keyedElement(layer, key);
    if (!target || target.hasAttribute("clip-path")) continue;
    target.setAttribute("clip-path", clipPath);
    const clipDefinition = keyedElement(fallback, `${key}:clip-defs`);
    if (clipDefinition) {
      target.insertBefore(clipDefinition.cloneNode(true), target.firstChild);
    }
  }
}
function copyMissingRendererDefinitions(svg, renderedRoot, layer, layerKey) {
  const pending = [...referencedIds(layer)];
  const visited = /* @__PURE__ */ new Set();
  let definitions;
  while (pending.length) {
    const id = pending.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    if (elementWithId(layer, id) || baseElementWithId(svg, id)) continue;
    const source = elementWithId(renderedRoot, id);
    if (!source) continue;
    if (!definitions) {
      definitions = svg.ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
      definitions.setAttribute("data-ts-key", `${layerKey}:renderer-defs`);
      layer.insertBefore(definitions, layer.firstChild);
    }
    const clone = source.cloneNode(true);
    definitions.append(clone);
    pending.push(...referencedIds(clone));
  }
}
function baseElementWithId(svg, id) {
  const element = elementWithId(svg, id);
  return element?.closest("[data-ts-focus-guide-layer]") ? void 0 : element;
}
function referencedIds(root) {
  const ids = /* @__PURE__ */ new Set();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of element.attributes) {
      for (const match of attribute.value.matchAll(/url\(#([^)]+)\)/g)) {
        if (match[1]) ids.add(match[1]);
      }
      if ((attribute.localName === "href" || attribute.name === "xlink:href") && attribute.value.startsWith("#")) {
        ids.add(attribute.value.slice(1));
      }
    }
  }
  return ids;
}
function elementWithId(root, id) {
  return [
    ...root.getAttribute("id") === id ? [root] : [],
    ...root.querySelectorAll("[id]")
  ].find((element) => element.getAttribute("id") === id);
}
function parseSvgMarkup(document, markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const root = template.content.firstElementChild;
  return root?.localName === "svg" ? root : void 0;
}
function parseSvgFragment(document, markup) {
  const template = document.createElement("template");
  template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
  return template.content.firstElementChild?.firstElementChild ?? void 0;
}
function keyedElement(root, key) {
  return keyedElements(root).find(
    (element) => element.getAttribute("data-ts-key") === key
  );
}
function keyedElements(root) {
  return [
    ...root.hasAttribute("data-ts-key") ? [root] : [],
    ...root.querySelectorAll("[data-ts-key]")
  ];
}
export {
  renderFocusGuideLayerWithRenderer
};
