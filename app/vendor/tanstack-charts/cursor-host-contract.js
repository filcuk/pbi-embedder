function createChartCursorHostSession(binding) {
  const extension = binding.use;
  if (extension.__chartExtensionType !== "cursor") {
    throw new TypeError("A chart cursor requires a cursor host extension.");
  }
  return extension.create(binding.controller);
}
export {
  createChartCursorHostSession
};
