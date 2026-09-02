import { compareChartKey, valueKey } from "./scales.js";
function groupRowsByChartKey(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const identity = valueKey(row.group);
    const existing = groups.get(identity);
    if (existing) existing.rows.push(row);
    else groups.set(identity, { group: row.group, rows: [row] });
  }
  return [...groups.entries()].sort(([, left], [, right]) => compareChartKey(left.group, right.group)).map(([identity, group]) => ({ identity, ...group }));
}
export {
  groupRowsByChartKey
};
