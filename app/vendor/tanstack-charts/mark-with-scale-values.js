import { normalizeMarkInitialization } from "./mark.js";
function createMarkWithScaleValues(initialize, motion) {
  const normalizedInitialize = (context) => {
    const initialized = normalizeMarkInitialization(initialize(context));
    return motion === void 0 || initialized.motion !== void 0 ? initialized : { ...initialized, motion };
  };
  return motion === void 0 ? { initialize: normalizedInitialize } : { initialize: normalizedInitialize, motion };
}
export {
  createMarkWithScaleValues
};
