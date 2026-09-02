import { createBandScale } from "./band-kernel.js";
function scalePoint(first, second) {
  return createBandScale(true, first, second);
}
export {
  scalePoint
};
