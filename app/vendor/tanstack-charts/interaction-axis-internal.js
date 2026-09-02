import { valueKey } from "./scales.js";
function createInteractionAxis(options) {
  const { axis, scale, sample } = options;
  if (!scale) throw new TypeError(`A ${axis}-axis interaction requires a scale`);
  assertValue(sample, `The ${axis}-axis interaction value`);
  const minimum = Math.min(...options.extent);
  const maximum = Math.max(...options.extent);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    throw new TypeError(`The ${axis}-axis interaction extent must be finite`);
  }
  const extent = [minimum, maximum];
  const values = options.values?.map(cloneValue);
  const keys = values?.map(valueKey);
  let positions;
  if (values) {
    if (!values.length) {
      throw new TypeError(
        `The ${axis}-axis interaction values must not be empty`
      );
    }
    const expectedKind = valueKind(sample);
    const unique = /* @__PURE__ */ new Set();
    positions = values.map((value, index) => {
      assertValue(value, `The ${axis}-axis interaction value at index ${index}`);
      if (valueKind(value) !== expectedKind) {
        throw new TypeError(
          `The ${axis}-axis interaction values must use one value type`
        );
      }
      const key = keys[index];
      if (unique.has(key)) {
        throw new TypeError(
          `The ${axis}-axis interaction values must be unique`
        );
      }
      unique.add(key);
      return mappedPosition(scale, value, axis);
    });
    assertMonotonePositions(positions, axis);
  } else {
    const kind = valueKind(sample);
    if (kind === "string") {
      throw new TypeError(
        `A string ${axis}-axis interaction requires explicit values`
      );
    }
    if (!scale.invert) {
      throw new TypeError(
        `A continuous ${axis}-axis interaction requires an invertible scale or explicit values`
      );
    }
  }
  const clampPosition = (position) => Math.max(minimum, Math.min(maximum, position));
  const indexOf = (value) => keys?.indexOf(valueKey(value)) ?? -1;
  const at = (index) => {
    if (!values?.length) {
      throw new TypeError(
        `The ${axis}-axis interaction requires explicit values for indexed movement`
      );
    }
    const bounded = Math.max(0, Math.min(values.length - 1, index));
    return cloneValue(values[bounded]);
  };
  const invert = (position) => {
    if (values || !scale.invert) {
      throw new TypeError(
        `The ${axis}-axis interaction requires a continuous scale inversion`
      );
    }
    if (!Number.isFinite(position)) {
      throw new TypeError(
        `The ${axis}-axis interaction position must be finite`
      );
    }
    const value = scale.invert(position);
    assertValue(value, `The ${axis}-axis scale inversion`);
    if (valueKind(value) !== valueKind(sample)) {
      throw new TypeError(
        `The ${axis}-axis scale inversion returned a different value type`
      );
    }
    return cloneValue(value);
  };
  return {
    scale,
    extent,
    ...values ? { values } : {},
    ...positions ? { positions } : {},
    position(value) {
      return mappedPosition(scale, value, axis);
    },
    invert,
    valueAt(position) {
      const bounded = clampPosition(position);
      if (values && positions) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        positions.forEach((candidate, index) => {
          const distance = Math.abs(candidate - bounded);
          if (distance < nearestDistance) {
            nearestIndex = index;
            nearestDistance = distance;
          }
        });
        return cloneValue(values[nearestIndex]);
      }
      return invert(bounded);
    },
    order(first, second) {
      if (values) {
        const firstIndex = indexOf(first);
        const secondIndex = indexOf(second);
        if (firstIndex < 0 || secondIndex < 0) {
          throw new TypeError(
            `The ${axis}-axis interaction range must use an explicit value`
          );
        }
        return firstIndex <= secondIndex ? [cloneValue(first), cloneValue(second)] : [cloneValue(second), cloneValue(first)];
      }
      return numericValue(first) <= numericValue(second) ? [cloneValue(first), cloneValue(second)] : [cloneValue(second), cloneValue(first)];
    },
    indexOf,
    at,
    step(value, amount) {
      const index = indexOf(value);
      if (index < 0) {
        throw new TypeError(
          `The ${axis}-axis interaction value is not in its explicit values`
        );
      }
      return at(index + amount);
    },
    clampPosition,
    layoutKey: valueKey
  };
}
function assertMonotonePositions(positions, axis) {
  if (positions.length < 2) return;
  const firstDelta = positions[1] - positions[0];
  if (firstDelta === 0) nonmonotone(axis);
  const direction = Math.sign(firstDelta);
  for (let index = 2; index < positions.length; index += 1) {
    const delta = positions[index] - positions[index - 1];
    if (!delta || Math.sign(delta) !== direction) nonmonotone(axis);
  }
}
function nonmonotone(axis) {
  throw new TypeError(
    `The ${axis}-axis interaction values must map to strictly monotone positions`
  );
}
function mappedPosition(scale, value, axis) {
  const position = scale.map(value);
  if (!Number.isFinite(position)) {
    throw new TypeError(
      `The ${axis}-axis interaction value must map to a finite position`
    );
  }
  return position;
}
function valueKind(value) {
  return value instanceof Date ? "date" : typeof value;
}
function numericValue(value) {
  return value instanceof Date ? value.getTime() : Number(value);
}
function assertValue(value, label) {
  if (value instanceof Date) {
    if (Number.isFinite(value.getTime())) return;
    throw new TypeError(`${label} must be a valid Date`);
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${label} must be finite`);
  }
  if (typeof value === "string") return;
  throw new TypeError(`${label} must be a chart value`);
}
function cloneValue(value) {
  return value instanceof Date ? new Date(value.getTime()) : value;
}
export {
  createInteractionAxis
};
