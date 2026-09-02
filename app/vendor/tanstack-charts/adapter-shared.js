function resolveChartAdapterLayout(options) {
  const initialWidth = options.width ?? options.initialWidth ?? 640;
  const aspectRatio = typeof options.aspectRatio === "number" && Number.isFinite(options.aspectRatio) && options.aspectRatio > 0 ? options.aspectRatio : void 0;
  return {
    aspectRatio,
    initialWidth,
    initialHeight: options.height ?? (aspectRatio === void 0 ? 320 : initialWidth / aspectRatio)
  };
}
function resolveChartHostTabIndex(definition, tabIndex = 0) {
  return definition.keyboard === false || definition.focus === false || definition.cursor?.mode === "free" ? -1 : tabIndex;
}
export {
  resolveChartAdapterLayout,
  resolveChartHostTabIndex
};
