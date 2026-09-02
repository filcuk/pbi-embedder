import { reconcileChartSvg, reconcileChartSvgFragment } from "./reconcile.js";
import { renderChartSvg } from "./svg.js";
import { focusedNodeKeys, resolveFocusScene } from "./focus-layer.js";
import { resolveFocusGuides } from "./focus-presentation.js";
import { renderFocusGuideLayer } from "./svg-renderer.js";
import { renderFocusGuideLayerWithRenderer } from "./svg-focus-guide-serializer.js";
import {
  detachSvgFocusGuideLayers,
  ensureSvgFocusGuideLayer,
  removeSvgFocusGuideLayer,
  restoreSvgFocusGuideLayers
} from "./svg-focus-guide-layer.js";
import { resolveMarkStateScene } from "./mark-state.js";
import { resolveMarkStateTransition } from "./mark-state-transition.js";
import { viewportTranslationChanged } from "./scene-point-map.js";
import { svgClientToScene } from "./svg-coordinates.js";
function createSvgChartRenderer(renderSvg = renderChartSvg) {
  const renderer = {
    id: "svg",
    prerender: renderSvg,
    mount(container) {
      let cancelAnimation = () => {
      };
      let cancelFocusAnimation = () => {
      };
      let scene;
      let renderOptions;
      let stateTransition;
      let markStatePainted = false;
      let retargetedFocus = false;
      const svgElement = () => {
        const svg = container.querySelector("svg.ts-chart");
        if (!svg) {
          throw new Error(
            "The SVG renderer must produce an svg.ts-chart root element."
          );
        }
        return svg;
      };
      const surface = {
        renderer,
        get element() {
          return svgElement();
        },
        render(nextScene, options) {
          const viewportMoved = Boolean(
            scene && viewportTranslationChanged(scene, nextScene)
          );
          cancelAnimation();
          cancelFocusAnimation();
          cancelFocusAnimation = () => {
          };
          const retainsFocusGuideLayers = Boolean(scene?.focusGuides?.length);
          const focusGuideLayers = retainsFocusGuideLayers ? detachSvgFocusGuideLayers(svgElement()) : {};
          cancelAnimation = reconcileChartSvg(
            container,
            renderSvg(nextScene, options),
            viewportMoved ? void 0 : options.animation
          );
          if (retainsFocusGuideLayers) {
            restoreSvgFocusGuideLayers(
              svgElement(),
              focusGuideLayers,
              (placement) => nextScene.focusGuides?.some(
                (guide) => guide.placement === placement
              ) === true
            );
          }
          scene = nextScene;
          renderOptions = options;
          stateTransition = void 0;
          markStatePainted = false;
          retargetedFocus = false;
        },
        clientToScene(scene2, clientX, clientY) {
          return svgClientToScene(svgElement(), scene2, clientX, clientY);
        },
        paintFocus(focus, pointer, cursor) {
          if (!scene || !renderOptions) return;
          const state = resolveMarkStateScene(scene, focus, pointer);
          const resolved = resolveFocusScene(state.scene, focus);
          const previousTransition = stateTransition;
          if (resolved.scene !== scene || markStatePainted || retargetedFocus || previousTransition) {
            cancelFocusAnimation();
            cancelFocusAnimation = () => {
            };
            const focusGuideLayers = detachSvgFocusGuideLayers(svgElement());
            cancelAnimation();
            cancelAnimation = reconcileChartSvg(
              container,
              renderSvg(resolved.scene, renderOptions),
              resolveMarkStateTransition(
                state.transition ?? previousTransition,
                container
              )
            );
            restoreSvgFocusGuideLayers(svgElement(), focusGuideLayers);
          }
          retargetedFocus = resolved.retargeted;
          markStatePainted = Boolean(focus && state.scene !== scene);
          stateTransition = focus ? state.transition ?? previousTransition : void 0;
          paintSvgFocus(svgElement(), resolved.scene, focus);
          cancelFocusAnimation();
          cancelFocusAnimation = paintSvgFocusGuides(
            svgElement(),
            resolved.scene,
            focus,
            pointer,
            cursor,
            renderOptions,
            renderSvg
          );
          return resolved.scene;
        },
        destroy() {
          cancelAnimation();
          cancelFocusAnimation();
        }
      };
      return surface;
    }
  };
  return renderer;
}
const svgChartRenderer = createSvgChartRenderer();
function paintSvgFocus(svg, scene, focus) {
  const sceneLayers = collectFocusLayers(scene.nodes);
  const elements = svg.querySelectorAll(
    "[data-ts-focus-layer]:not([data-ts-focus-guide-layer])"
  );
  elements.forEach((element, index) => {
    const layer = sceneLayers[index];
    const visible = layer ? focusedNodeKeys(layer, focus) : /* @__PURE__ */ new Set();
    element.setAttribute(
      "visibility",
      focus && visible.size ? "visible" : "hidden"
    );
    element.querySelectorAll("[data-ts-key]").forEach((child) => {
      const key = child.dataset.tsKey;
      child.setAttribute(
        "visibility",
        key && visible.has(key) ? "visible" : "hidden"
      );
    });
  });
}
function paintSvgFocusGuides(svg, scene, focus, pointer, cursor, renderOptions, renderSvg) {
  const presentation = resolveFocusGuides(scene, focus, pointer, cursor);
  const cancellations = [];
  for (const placement of ["under", "over"]) {
    if (!scene.focusGuides?.some((guide) => guide.placement === placement)) {
      removeSvgFocusGuideLayer(svg, placement);
      continue;
    }
    const layer = ensureSvgFocusGuideLayer(svg, placement);
    const nodes = presentation[placement];
    if (!nodes.length) {
      layer.setAttribute("visibility", "hidden");
      continue;
    }
    const markup = renderSvg === renderChartSvg ? renderFocusGuideLayer(nodes, placement, renderOptions.idPrefix ?? "") : renderFocusGuideLayerWithRenderer(
      svg,
      scene,
      nodes,
      placement,
      renderOptions,
      renderSvg
    );
    cancellations.push(reconcileChartSvgFragment(layer, markup));
  }
  return () => cancellations.forEach((cancel) => cancel());
}
function collectFocusLayers(nodes) {
  const layers = [];
  for (const node of nodes) {
    if (node.kind !== "group") continue;
    if (node.focus) {
      layers.push(node);
    } else {
      layers.push(...collectFocusLayers(node.children));
    }
  }
  return layers;
}
export {
  createSvgChartRenderer,
  svgChartRenderer
};
