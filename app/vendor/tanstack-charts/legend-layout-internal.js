import { valueKey } from "./scales.js";
function resolveCategoricalLegendItems(colors, format = String) {
  return colors.domain.map((value) => ({
    key: valueKey(value),
    value,
    label: format(value),
    color: colors.map(value)
  }));
}
function layoutCategoricalLegendItems(itemCount, width, minimumItemWidth) {
  const columns = Math.max(
    1,
    Math.min(itemCount || 1, Math.floor(width / minimumItemWidth) || 1)
  );
  return {
    columns,
    rows: Math.ceil(itemCount / columns),
    itemWidth: width / columns
  };
}
export {
  layoutCategoricalLegendItems,
  resolveCategoricalLegendItems
};
