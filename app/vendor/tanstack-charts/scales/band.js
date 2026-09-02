import { createBandScale } from "./band-kernel.js";
function scaleBand(first, second) {
  return createBandScale(false, first, second);
}
export {
  scaleBand
};
