function intern(value) {
  return value instanceof Date ? `date:${value.getTime()}` : `${typeof value}:${String(value)}`;
}
function uniqueDomain(values) {
  const domain = [];
  const index = /* @__PURE__ */ new Map();
  for (const value of values) {
    const key = intern(value);
    if (index.has(key)) continue;
    index.set(key, domain.length);
    domain.push(value);
  }
  return { domain, index };
}
export {
  intern,
  uniqueDomain
};
