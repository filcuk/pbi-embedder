import { createDecorativeMark } from "./mark-decorative-internal.js";
import { stripMarkSceneInteraction } from "./mark-scene-filter-internal.js";
function decorative(mark) {
  return createDecorativeMark(
    mark,
    (scene) => stripMarkSceneInteraction(scene, {
      conditional: "reject"
    }),
    {
      conditional: "reject",
      layoutLabels: "preserve"
    }
  );
}
export {
  decorative
};
