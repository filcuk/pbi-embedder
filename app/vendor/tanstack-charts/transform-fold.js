import { toArray } from "./transform-internal.js";
function fold(source, options) {
  const data = toArray(source);
  const keyName = options.as?.key ?? "key";
  const valueName = options.as?.value ?? "value";
  assertFoldOptions(options.fields, keyName, valueName);
  return data.flatMap(
    (datum, sourceIndex) => options.fields.map((field) => ({
      ...datum,
      source: [datum],
      sourceIndexes: [sourceIndex],
      [keyName]: field,
      [valueName]: datum[field]
    }))
  );
}
function assertFoldOptions(fields, keyName, valueName) {
  if (keyName === valueName) {
    throw new TypeError("fold: output names must be distinct");
  }
  for (const name of [keyName, valueName]) {
    if (name === "source" || name === "sourceIndexes") {
      throw new TypeError(`fold: output name "${name}" is reserved`);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (const field of fields) {
    if (seen.has(field)) {
      throw new TypeError(`fold: duplicate field "${field}"`);
    }
    seen.add(field);
  }
}
export {
  fold
};
