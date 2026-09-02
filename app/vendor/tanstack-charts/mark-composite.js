import { createMark } from "./mark.js";
import { initializeCompositeMark } from "./mark-composite-internal.js";
function compositeMark(marks, options = {}) {
  return createMark(({ markIndex }) => {
    const id = options.id ?? `composite-${markIndex}`;
    return initializeCompositeMark(id, marks, { motion: options.motion });
  });
}
export {
  compositeMark
};
