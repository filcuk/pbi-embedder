function createPolarMark(initialize, motion) {
  if (motion === void 0) return { initialize };
  return {
    motion,
    initialize(context) {
      return { ...initialize(context), motion };
    }
  };
}
export {
  createPolarMark
};
