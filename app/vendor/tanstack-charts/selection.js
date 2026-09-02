import { createDecorativeMark } from "./mark-decorative-internal.js";
import { filterMarkSceneByPoint } from "./mark-scene-filter-internal.js";
import { valueKey } from "./scales.js";
function keyedSelection(options) {
  const matches = (point) => {
    const selected = options.selected.value;
    const key = options.key(point.datum, { point });
    return selected !== null && key !== null && key !== void 0 && valueKey(selected) === valueKey(key);
  };
  return {
    type: "keyed",
    selected: options.selected,
    key: options.key,
    matches,
    change(point, source) {
      if (point) {
        const next2 = options.key(point.datum, { point });
        if (next2 === null || next2 === void 0) return;
        options.selected.onChange(next2, {
          reason: {
            type: "select",
            value: next2,
            point,
            source
          }
        });
        return;
      }
      if (options.selected.value === null) return;
      const next = null;
      options.selected.onChange(next, {
        reason: {
          type: "clear",
          value: next,
          point,
          source
        }
      });
    }
  };
}
function whenSelected(mark, selection) {
  const filter = (scene) => filterMarkSceneByPoint(scene, selection.matches, {
    interaction: "remove"
  });
  return createDecorativeMark(mark, filter, {
    conditional: "remove",
    layoutLabels: "remove"
  });
}
export {
  keyedSelection,
  whenSelected
};
