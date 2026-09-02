import { createChartScene, defaultChartTheme } from "./scene.js";
function createChartRuntime(options = {}) {
  const platformTheme = {
    ...defaultChartTheme,
    ...options.defaultTheme,
    palette: options.defaultTheme?.palette ?? defaultChartTheme.palette
  };
  return {
    render(definition, size, layout) {
      if (!isResponsiveChartDefinition(definition)) {
        return createChartScene(definition, size, {
          ...layout,
          defaultTheme: platformTheme
        });
      }
      const { chart, ...options2 } = definition;
      const spec = chart({
        width: size.width,
        height: size.height,
        defaultTheme: platformTheme
      });
      return createChartScene({ ...spec, ...options2 }, size, {
        ...layout,
        defaultTheme: platformTheme
      });
    },
    destroy() {
    }
  };
}
function isResponsiveChartDefinition(definition) {
  return "chart" in definition && typeof definition.chart === "function";
}
export {
  createChartRuntime,
  isResponsiveChartDefinition
};
