import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY
} from "d3-force";
import { resolveNetworkGraph } from "./network-graph-internal.js";
import { transformValues } from "./transform-internal.js";
function forceLayout(nodes, links, options) {
  const graph = resolveNetworkGraph(
    nodes,
    links,
    {
      nodeKey: options.nodeKey,
      source: options.source,
      target: options.target
    },
    "forceLayout"
  );
  const nodeData = graph.nodes;
  const linkData = graph.links;
  const iterations = options.iterations ?? 300;
  const domainPadding = options.domainPadding ?? 0.2;
  assertNonnegativeInteger(iterations, "iterations");
  assertNonnegativeFinite(domainPadding, "domainPadding");
  assertUniqueForces(options.forces);
  const { nodeKeys, sourceKeys, targetKeys, nodeIndexes } = graph;
  const workingNodes = nodeData.map(createWorkingNode);
  const workingLinks = linkData.map(
    (link, index) => createWorkingLink(
      link,
      sourceKeys[index],
      targetKeys[index]
    )
  );
  const originalWorkingNodes = [...workingNodes];
  const originalWorkingLinks = [...workingLinks];
  const factoryContext = createForceFactoryContext(
    workingNodes,
    workingLinks,
    nodeKeys,
    sourceKeys,
    targetKeys
  );
  const preparedForces = options.forces.map((descriptor, index) => ({
    descriptor,
    force: createForce(
      descriptor,
      index,
      nodeData,
      linkData,
      nodeKeys,
      workingLinks,
      factoryContext
    )
  }));
  assertWorkingCollection(workingNodes, originalWorkingNodes, "node");
  assertWorkingCollection(workingLinks, originalWorkingLinks, "link");
  const simulation = forceSimulation(workingNodes).stop();
  preparedForces.forEach(({ descriptor, force }, index) => {
    simulation.force(`${index}:${forceName(descriptor)}`, force);
  });
  simulation.tick(iterations);
  assertWorkingCollection(workingNodes, originalWorkingNodes, "node");
  assertWorkingCollection(workingLinks, originalWorkingLinks, "link");
  const outputNodes = workingNodes.map((node, index) => {
    const datum = nodeData[index];
    return {
      ...datum,
      x: coordinate(node.x, index, "x"),
      y: coordinate(node.y, index, "y"),
      vx: coordinate(node.vx, index, "vx"),
      vy: coordinate(node.vy, index, "vy"),
      source: [datum],
      sourceIndexes: [index]
    };
  });
  const outputLinks = linkData.map((link, index) => {
    const source = sourceKeys[index];
    const target = targetKeys[index];
    const sourceIndex = nodeIndexes.get(source);
    const targetIndex = nodeIndexes.get(target);
    const sourceNode = outputNodes[sourceIndex];
    const targetNode = outputNodes[targetIndex];
    return {
      ...link,
      source,
      target,
      sourceKey: source,
      targetKey: target,
      sourceIndex,
      targetIndex,
      sourceNode,
      targetNode,
      x1: sourceNode.x,
      y1: sourceNode.y,
      x2: targetNode.x,
      y2: targetNode.y,
      sourceRows: [link],
      sourceIndexes: [index]
    };
  });
  return {
    nodes: outputNodes,
    links: outputLinks,
    xDomain: paddedDomain(
      outputNodes.map((node) => node.x),
      domainPadding
    ),
    yDomain: paddedDomain(
      outputNodes.map((node) => node.y),
      domainPadding
    )
  };
}
const simulationNodeFields = ["x", "y", "vx", "vy", "fx", "fy"];
function createWorkingNode(node) {
  const working = { ...node };
  delete working.index;
  for (const field of simulationNodeFields) {
    const value = working[field];
    const validFixedValue = (field === "fx" || field === "fy") && value === null;
    if (value !== void 0 && !validFixedValue && (typeof value !== "number" || !Number.isFinite(value))) {
      delete working[field];
    }
  }
  return working;
}
function createWorkingLink(link, source, target) {
  const working = {
    ...link,
    source,
    target
  };
  delete working.index;
  return working;
}
function createForce(descriptor, descriptorIndex, nodes, links, nodeKeys, workingLinks, factoryContext) {
  const name = `forces[${descriptorIndex}] (${forceName(descriptor)})`;
  switch (descriptor.type) {
    case "link": {
      const force = forceLink(
        workingLinks
      ).id((_node, index) => nodeKeys[index]);
      const distance = forceValue(
        links,
        descriptor.distance,
        `${name}.distance`,
        assertNonnegativeFinite
      );
      const strength = forceValue(
        links,
        descriptor.strength,
        `${name}.strength`,
        assertNonnegativeFinite
      );
      if (distance !== void 0) force.distance(distance);
      if (strength !== void 0) force.strength(strength);
      return force;
    }
    case "manyBody": {
      const force = forceManyBody();
      const strength = forceValue(
        nodes,
        descriptor.strength,
        `${name}.strength`
      );
      if (strength !== void 0) force.strength(strength);
      return force;
    }
    case "center":
      assertOptionalFinite(descriptor.x, `${name}.x`);
      assertOptionalFinite(descriptor.y, `${name}.y`);
      return forceCenter(descriptor.x, descriptor.y);
    case "collide": {
      const force = forceCollide();
      const radius = forceValue(
        nodes,
        descriptor.radius,
        `${name}.radius`,
        assertNonnegativeFinite
      );
      if (radius !== void 0) force.radius(radius);
      if (descriptor.strength !== void 0) {
        assertRange(descriptor.strength, 0, 1, `${name}.strength`);
        force.strength(descriptor.strength);
      }
      return force;
    }
    case "x": {
      const force = forceX();
      const x = forceValue(nodes, descriptor.x, `${name}.x`);
      const strength = forceValue(
        nodes,
        descriptor.strength,
        `${name}.strength`,
        assertUnitInterval
      );
      if (x !== void 0) force.x(x);
      if (strength !== void 0) force.strength(strength);
      return force;
    }
    case "y": {
      const force = forceY();
      const y = forceValue(nodes, descriptor.y, `${name}.y`);
      const strength = forceValue(
        nodes,
        descriptor.strength,
        `${name}.strength`,
        assertUnitInterval
      );
      if (y !== void 0) force.y(y);
      if (strength !== void 0) force.strength(strength);
      return force;
    }
    case "custom": {
      const force = descriptor.create(factoryContext);
      if (typeof force !== "function") {
        throw new TypeError(
          `forceLayout: ${name}.create must return a D3-compatible force`
        );
      }
      return force;
    }
  }
}
function forceValue(data, value, name, validate = assertFinite) {
  if (value === void 0) return void 0;
  if (typeof value === "number") {
    validate(value, name);
    return value;
  }
  const values = transformValues(data, value);
  values.forEach((resolved, index) => {
    assertFinite(resolved, `${name} at index ${index}`);
    validate(resolved, `${name} at index ${index}`);
  });
  return (_datum, index) => values[index];
}
function assertUniqueForces(descriptors) {
  const types = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  descriptors.forEach((descriptor, index) => {
    const type = descriptor.type;
    if (type === "custom") {
      const custom = descriptor;
      if (typeof custom.name !== "string" || !custom.name.trim()) {
        throw new TypeError(
          `forceLayout: forces[${index}].name must be a nonempty string`
        );
      }
      if (typeof custom.create !== "function") {
        throw new TypeError(
          `forceLayout: forces[${index}] (${custom.name}).create must be a function`
        );
      }
      if (names.has(custom.name)) {
        throw new TypeError(
          `forceLayout: duplicate force name "${custom.name}"`
        );
      }
      names.add(custom.name);
      return;
    }
    if (type !== "link" && type !== "manyBody" && type !== "center" && type !== "collide" && type !== "x" && type !== "y") {
      throw new TypeError(`forceLayout: forces[${index}] has an unknown type`);
    }
    if (types.has(type)) {
      throw new TypeError(`forceLayout: duplicate force type "${type}"`);
    }
    if (names.has(type)) {
      throw new TypeError(`forceLayout: duplicate force name "${type}"`);
    }
    types.add(type);
    names.add(type);
  });
}
function forceName(descriptor) {
  return descriptor.type === "custom" ? descriptor.name : descriptor.type;
}
function createForceFactoryContext(nodes, links, nodeKeys, sourceKeys, targetKeys) {
  const keyByNode = new Map(
    nodes.map((node, index) => [node, nodeKeys[index]])
  );
  return Object.freeze({
    nodes,
    links,
    nodeKeys: Object.freeze([...nodeKeys]),
    sourceKeys: Object.freeze([...sourceKeys]),
    targetKeys: Object.freeze([...targetKeys]),
    nodeKey: (node) => {
      const key = keyByNode.get(node);
      if (key === void 0) {
        throw new TypeError(
          "forceLayout: custom force requested the key of a foreign node"
        );
      }
      return key;
    }
  });
}
function assertWorkingCollection(values, expected, name) {
  if (values.length !== expected.length || values.some((value, index) => value !== expected[index])) {
    throw new TypeError(
      `forceLayout: custom force changed the private ${name} collection`
    );
  }
}
function assertNonnegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`forceLayout: ${name} must be a nonnegative integer`);
  }
}
function assertNonnegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `forceLayout: ${name} must be a nonnegative finite number`
    );
  }
}
function assertUnitInterval(value, name) {
  assertRange(value, 0, 1, name);
}
function assertOptionalFinite(value, name) {
  if (value !== void 0) assertFinite(value, name);
}
function assertRange(value, minimum, maximum, name) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `forceLayout: ${name} must be between ${minimum} and ${maximum}`
    );
  }
}
function assertFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`forceLayout: ${name} must be a finite number`);
  }
}
function coordinate(value, index, coordinateName) {
  if (value === void 0 || !Number.isFinite(value)) {
    throw new TypeError(
      `forceLayout: simulation produced a non-finite ${coordinateName} for node index ${index}`
    );
  }
  return value;
}
function paddedDomain(values, padding) {
  if (values.length === 0) return [-1, 1];
  let minimum = values[0];
  let maximum = minimum;
  for (const value of values.slice(1)) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  const amount = Math.max(1, maximum - minimum) * padding;
  return [minimum - amount, maximum + amount];
}
export {
  forceLayout
};
