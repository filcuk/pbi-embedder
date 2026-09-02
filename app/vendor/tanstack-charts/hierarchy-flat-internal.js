import { stratify } from "d3-hierarchy";
import { toArray, transformValues } from "./transform-internal.js";
function buildFlatHierarchy(source, options, owner) {
  const data = toArray(source);
  const sourceRows = data.map((datum, index) => ({ datum, index }));
  const pathMode = options.path !== void 0;
  let root;
  try {
    if (pathMode) {
      const normalize = pathNormalizer(options.delimiter, owner);
      const paths = transformValues(data, options.path).map((path, index) => {
        if (typeof path !== "string" || path.length === 0) {
          throw new TypeError(
            `${owner}: path at index ${index} must be a nonempty string`
          );
        }
        return normalize(path);
      });
      assertUnique(paths, "path", owner);
      root = stratify().path(
        (row) => paths[row.index]
      )(sourceRows);
    } else {
      const parentOptions = options;
      const ids = transformValues(data, parentOptions.id);
      const parentIds = transformValues(data, parentOptions.parentId);
      ids.forEach((id, index) => assertId(id, `id at index ${index}`, owner));
      assertUnique(ids, "id", owner);
      parentIds.forEach((id, index) => {
        if (id != null) assertId(id, `parentId at index ${index}`, owner);
      });
      root = stratify().id((row) => ids[row.index]).parentId((row) => parentIds[row.index] ?? void 0)(
        sourceRows
      );
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(`${owner}:`)) {
      throw error;
    }
    throw new TypeError(
      `${owner}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const hierarchyIds = /* @__PURE__ */ new Set();
  for (const node of root.descendants()) {
    const id = node.id;
    if (id === void 0) {
      throw new TypeError(`${owner}: hierarchy node is missing an id`);
    }
    if (hierarchyIds.has(id)) {
      throw new TypeError(`${owner}: duplicate hierarchy id "${id}"`);
    }
    hierarchyIds.add(id);
    const sourceRow = node.data;
    node.data = {
      id,
      parentId: node.parent?.id ?? null,
      name: pathMode ? pathName(id) : id,
      datum: sourceRow === null ? null : sourceRow.datum,
      sourceIndex: sourceRow?.index ?? null
    };
  }
  return {
    data,
    root
  };
}
function flatHierarchyNodeContext(node) {
  const { datum, id, name, parentId, sourceIndex } = node.data;
  const source = Object.freeze(
    sourceIndex === null ? [] : [datum]
  );
  const sourceIndexes = Object.freeze(
    sourceIndex === null ? [] : [sourceIndex]
  );
  return {
    id,
    parentId,
    name,
    data: datum,
    depth: node.depth,
    height: node.height,
    internal: node.children !== void 0,
    external: node.children === void 0,
    source,
    sourceIndexes
  };
}
function aggregateFlatHierarchyValues(hierarchy, value, owner) {
  const values = transformValues(hierarchy.data, value).map(
    (resolved, index) => {
      if (resolved == null) return 0;
      assertNonnegativeFinite(resolved, `value at index ${index}`, owner);
      return resolved;
    }
  );
  hierarchy.root.sum(
    ({ sourceIndex }) => sourceIndex === null ? 0 : values[sourceIndex]
  );
  for (const node of hierarchy.root.descendants()) {
    assertNonnegativeFinite(
      node.value,
      `aggregate value for node "${node.data.id}"`,
      owner
    );
  }
}
function flatHierarchyAncestorIds(node) {
  const ids = [];
  let parent = node.parent;
  while (parent) {
    ids.push(parent.data.id);
    parent = parent.parent;
  }
  ids.reverse();
  return Object.freeze(ids);
}
function flatHierarchyBranchId(node) {
  if (node.depth === 0) return null;
  let branch = node;
  while (branch.depth > 1) {
    branch = branch.parent;
  }
  return branch.data.id;
}
function flatHierarchyNodeValue(node) {
  return Number.isFinite(node.value) ? node.value : 0;
}
function assertUnique(values, description, owner) {
  const indexes = /* @__PURE__ */ new Map();
  values.forEach((value, index) => {
    const previous = indexes.get(value);
    if (previous !== void 0) {
      throw new TypeError(
        `${owner}: duplicate ${description} "${value}" at indexes ${previous} and ${index}`
      );
    }
    indexes.set(value, index);
  });
}
function assertId(value, description, owner) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${owner}: ${description} must be a nonempty string`);
  }
}
function assertNonnegativeFinite(value, description, owner) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `${owner}: ${description} must be nonnegative and finite`
    );
  }
}
function pathNormalizer(delimiter = "/", owner) {
  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new TypeError(`${owner}: delimiter must be exactly one character`);
  }
  if (delimiter === "\\") {
    throw new TypeError(`${owner}: delimiter cannot be backslash`);
  }
  if (delimiter === "/") return (path) => path;
  const delimiterCode = delimiter.charCodeAt(0);
  return (path) => slashDelimiter(path, delimiterCode);
}
const backslashCode = 92;
const slashCode = 47;
function slashDelimiter(input, delimiterCode) {
  let afterBackslash = false;
  for (let index = 0, length = input.length; index < length; index += 1) {
    switch (input.charCodeAt(index)) {
      case backslashCode:
        if (!afterBackslash) {
          afterBackslash = true;
          continue;
        }
        break;
      case delimiterCode:
        if (afterBackslash) {
          input = input.slice(0, index - 1) + input.slice(index);
          index -= 1;
          length -= 1;
        } else {
          input = `${input.slice(0, index)}/${input.slice(index + 1)}`;
        }
        break;
      case slashCode:
        if (afterBackslash) {
          input = `${input.slice(0, index)}\\\\${input.slice(index)}`;
          index += 2;
          length += 2;
        } else {
          input = `${input.slice(0, index)}\\${input.slice(index)}`;
          index += 1;
          length += 1;
        }
        break;
    }
    afterBackslash = false;
  }
  return input;
}
function pathName(path) {
  let index = path.length;
  while (--index > 0) {
    if (isPathSlash(path, index)) break;
  }
  return unescapePath(path.slice(index + 1));
}
function isPathSlash(path, index) {
  if (path[index] !== "/") return false;
  let escapes = 0;
  while (index > 0 && path[--index] === "\\") escapes += 1;
  return escapes % 2 === 0;
}
function unescapePath(input) {
  let afterBackslash = false;
  for (let index = 0, length = input.length; index < length; index += 1) {
    const code = input.charCodeAt(index);
    if (code === backslashCode && !afterBackslash) {
      afterBackslash = true;
      continue;
    }
    if ((code === backslashCode || code === slashCode) && afterBackslash) {
      input = input.slice(0, index - 1) + input.slice(index);
      index -= 1;
      length -= 1;
    }
    afterBackslash = false;
  }
  return input;
}
export {
  aggregateFlatHierarchyValues,
  buildFlatHierarchy,
  flatHierarchyAncestorIds,
  flatHierarchyBranchId,
  flatHierarchyNodeContext,
  flatHierarchyNodeValue
};
