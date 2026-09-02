import { toArray, transformValues } from "./transform-internal.js";
function resolveNetworkGraph(nodeSource, linkSource, options, owner) {
  const nodes = toArray(nodeSource);
  const links = toArray(linkSource);
  const nodeKeys = transformValues(nodes, options.nodeKey);
  const sourceKeys = transformValues(links, options.source);
  const targetKeys = transformValues(links, options.target);
  const nodeIndexes = /* @__PURE__ */ new Map();
  nodeKeys.forEach((key, index) => {
    assertNetworkKey(key, `nodeKey at index ${index}`, owner);
    if (nodeIndexes.has(key)) {
      throw new TypeError(
        `${owner}: duplicate node key ${formatNetworkKey(key)}`
      );
    }
    nodeIndexes.set(key, index);
  });
  sourceKeys.forEach((key, index) => {
    assertNetworkEndpoint(key, index, "source", nodeIndexes, owner);
  });
  targetKeys.forEach((key, index) => {
    assertNetworkEndpoint(key, index, "target", nodeIndexes, owner);
  });
  return {
    nodes,
    links,
    nodeKeys,
    sourceKeys,
    targetKeys,
    nodeIndexes
  };
}
function assertNetworkEndpoint(key, index, endpoint, nodeIndexes, owner) {
  assertNetworkKey(key, `${endpoint} at link index ${index}`, owner);
  if (!nodeIndexes.has(key)) {
    throw new TypeError(
      `${owner}: ${endpoint} at link index ${index} does not match a node key: ${formatNetworkKey(key)}`
    );
  }
}
function assertNetworkKey(value, name, owner) {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
    throw new TypeError(`${owner}: ${name} must be a string or finite number`);
  }
}
function formatNetworkKey(key) {
  return `${typeof key}:${JSON.stringify(key)}`;
}
export {
  resolveNetworkGraph
};
