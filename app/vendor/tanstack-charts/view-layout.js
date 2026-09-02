const viewLayoutBrand = /* @__PURE__ */ Symbol("tanstack-view-layout-brand");
const viewLayoutRecord = /* @__PURE__ */ Symbol("tanstack-view-layout-record");
function fill(view) {
  const id = validId(view, "fill view");
  return createLayout([id], [], (bounds, state) => {
    placeFrame(id, bounds, state);
  });
}
function inset(view, options) {
  const resolvedView = validId(view, "inset view");
  const relativeTo = validId(options.relativeTo, "inset relativeTo");
  if (resolvedView === relativeTo) {
    throw new TypeError(`View inset "${resolvedView}" cannot reference itself`);
  }
  const placement = {
    relativeTo,
    anchor: validAnchor(options.anchor),
    width: positiveFinite(options.width, "View inset width"),
    height: positiveFinite(options.height, "View inset height"),
    offset: nonNegativeFinite(options.offset ?? 0, "View inset offset")
  };
  return createLayout([resolvedView], [relativeTo], (_bounds, state) => {
    const target = state.frames.get(relativeTo);
    if (!target) {
      throw new TypeError(
        `View inset "${resolvedView}" cannot resolve "${relativeTo}"; inset references must target an earlier resolved view and may not form a cycle`
      );
    }
    placeFrame(resolvedView, resolveInset(placement, target), state);
  });
}
function layer(...layouts) {
  if (!layouts.length) throw new TypeError("layer requires at least one layout");
  const children = layouts.map(layoutRecordOf);
  return createLayout(
    children.flatMap((child) => child.placed),
    unique(children.flatMap((child) => child.referenced)),
    (bounds, state) => {
      children.forEach((child) => child.resolve(bounds, state));
    }
  );
}
function grid(options) {
  const rows = validateTracks(options.rows, "row");
  const columns = validateTracks(options.columns, "column");
  const gap = nonNegativeFinite(options.gap ?? 12, "View grid gap");
  const rowGap = nonNegativeFinite(options.rowGap ?? gap, "View grid rowGap");
  const columnGap = nonNegativeFinite(
    options.columnGap ?? gap,
    "View grid columnGap"
  );
  const cells = Object.entries(options.cells);
  if (!cells.length) throw new TypeError("grid requires at least one cell");
  const viewIds = /* @__PURE__ */ new Set();
  const occupied = /* @__PURE__ */ new Map();
  const prepared = cells.map(([authoredView, cell]) => {
    const view = validId(authoredView, "grid view");
    if (viewIds.has(view)) {
      throw new TypeError(`View grid contains duplicate view id "${view}"`);
    }
    viewIds.add(view);
    const row = validId(cell.row, `View grid "${view}" row`);
    const column = validId(cell.column, `View grid "${view}" column`);
    if (!rows.indexes.has(row)) {
      throw new TypeError(
        `View grid "${view}" references unknown row track "${row}"`
      );
    }
    if (!columns.indexes.has(column)) {
      throw new TypeError(
        `View grid "${view}" references unknown column track "${column}"`
      );
    }
    const coordinate = `${row}:${column}`;
    const existing = occupied.get(coordinate);
    if (existing) {
      throw new TypeError(
        `Views "${existing}" and "${view}" occupy the same grid cell`
      );
    }
    occupied.set(coordinate, view);
    return { view, row, column };
  });
  const placement = {
    rows: rows.tracks,
    columns: columns.tracks,
    cells: prepared,
    rowGap,
    columnGap
  };
  return createLayout(
    prepared.map((cell) => cell.view),
    [],
    (bounds, state) => resolveGrid(placement, bounds, state)
  );
}
function getViewLayoutMetadataInternal(layout) {
  const record = layoutRecordOf(layout);
  return {
    // Preserve duplicate placements so composition can reject them before
    // scene compilation. Repeated references are valid and need no ordering.
    placed: [...record.placed],
    referenced: [...record.referenced]
  };
}
function resolveViewLayoutInternal(layout, bounds) {
  const outer = validBounds(bounds);
  const record = layoutRecordOf(layout);
  const state = {
    frames: /* @__PURE__ */ new Map(),
    ordered: []
  };
  record.resolve(outer, state);
  return state.ordered;
}
function resolveGrid(placement, bounds, state) {
  const rowGap = fittedGap(
    bounds.height,
    placement.rowGap,
    placement.rows.length
  );
  const columnGap = fittedGap(
    bounds.width,
    placement.columnGap,
    placement.columns.length
  );
  const rowSizes = resolveTracks(placement.rows, bounds.height, rowGap);
  const columnSizes = resolveTracks(placement.columns, bounds.width, columnGap);
  const rowOffsets = trackOffsets(rowSizes, rowGap, bounds.y);
  const columnOffsets = trackOffsets(columnSizes, columnGap, bounds.x);
  const rowIndexes = new Map(
    placement.rows.map((track, index) => [track.id, index])
  );
  const columnIndexes = new Map(
    placement.columns.map((track, index) => [track.id, index])
  );
  placement.cells.forEach((cell) => {
    const rowIndex = rowIndexes.get(cell.row);
    const columnIndex = columnIndexes.get(cell.column);
    placeFrame(
      cell.view,
      {
        x: columnOffsets[columnIndex],
        y: rowOffsets[rowIndex],
        width: columnSizes[columnIndex],
        height: rowSizes[rowIndex]
      },
      state
    );
  });
}
function placeFrame(id, bounds, state) {
  if (state.frames.has(id)) {
    throw new TypeError(`View layout places "${id}" more than once`);
  }
  const frame = {
    id,
    ...validBounds(bounds),
    order: state.ordered.length
  };
  state.frames.set(id, frame);
  state.ordered.push(frame);
}
function resolveInset(placement, target) {
  const ratio = Math.min(
    1,
    target.width / (placement.width + placement.offset * 2),
    target.height / (placement.height + placement.offset * 2)
  );
  const width = placement.width * ratio;
  const height = placement.height * ratio;
  const offset = placement.offset * ratio;
  const left = target.x + offset;
  const centerX = target.x + (target.width - width) / 2;
  const right = target.x + target.width - offset - width;
  const top = target.y + offset;
  const centerY = target.y + (target.height - height) / 2;
  const bottom = target.y + target.height - offset - height;
  switch (placement.anchor) {
    case "top-left":
      return { x: left, y: top, width, height };
    case "top":
      return { x: centerX, y: top, width, height };
    case "top-right":
      return { x: right, y: top, width, height };
    case "right":
      return { x: right, y: centerY, width, height };
    case "bottom-right":
      return { x: right, y: bottom, width, height };
    case "bottom":
      return { x: centerX, y: bottom, width, height };
    case "bottom-left":
      return { x: left, y: bottom, width, height };
    case "left":
      return { x: left, y: centerY, width, height };
    case "center":
      return { x: centerX, y: centerY, width, height };
  }
}
function createLayout(placed, referenced, resolve) {
  const record = Object.freeze({
    placed: Object.freeze([...placed]),
    referenced: Object.freeze([...referenced]),
    resolve
  });
  return Object.freeze({
    [viewLayoutBrand]: void 0,
    [viewLayoutRecord]: record
  });
}
function layoutRecordOf(layout) {
  const record = layout?.[viewLayoutRecord];
  if (!record) {
    throw new TypeError(
      "View layouts must be created with fill, grid, layer, or inset"
    );
  }
  return record;
}
function validateTracks(input, axis) {
  if (!input.length) {
    throw new TypeError(`grid requires at least one ${axis} track`);
  }
  const indexes = /* @__PURE__ */ new Map();
  const tracks = input.map((authored, index) => {
    const id = validId(authored.id, `View grid ${axis} track ${index}`);
    if (indexes.has(id)) {
      throw new TypeError(`View grid contains duplicate ${axis} track "${id}"`);
    }
    indexes.set(id, index);
    if ("size" in authored && authored.size !== void 0) {
      if ("grow" in authored && authored.grow !== void 0) {
        throw new TypeError(
          `View grid ${axis} track "${id}" cannot set both size and grow`
        );
      }
      return {
        id,
        size: positiveFinite(
          authored.size,
          `View grid ${axis} track "${id}" size`
        )
      };
    }
    if (!("grow" in authored) || authored.grow === void 0) {
      throw new TypeError(
        `View grid ${axis} track "${id}" requires size or grow`
      );
    }
    const grow = positiveFinite(
      authored.grow,
      `View grid ${axis} track "${id}" grow`
    );
    const min = authored.min === void 0 ? void 0 : positiveFinite(authored.min, `View grid ${axis} track "${id}" min`);
    const max = authored.max === void 0 ? void 0 : positiveFinite(authored.max, `View grid ${axis} track "${id}" max`);
    if (max !== void 0 && max < (min ?? 1)) {
      throw new TypeError(
        `View grid ${axis} track "${id}" max must be at least min`
      );
    }
    return {
      id,
      grow,
      ...min === void 0 ? {} : { min },
      ...max === void 0 ? {} : { max }
    };
  });
  return { tracks, indexes };
}
function resolveTracks(tracks, total, gap) {
  const available = Math.max(
    Number.EPSILON,
    total - gap * Math.max(0, tracks.length - 1)
  );
  const sizes = tracks.map(
    (track) => track.size !== void 0 ? track.size : track.min ?? 1
  );
  const preferred = sizes.reduce((sum, size) => sum + size, 0);
  if (preferred >= available) {
    const ratio = available / preferred;
    return sizes.map((size) => size * ratio);
  }
  let remaining = available - preferred;
  let active = tracks.flatMap(
    (track, index) => track.size !== void 0 ? [] : [index]
  );
  while (remaining > Number.EPSILON && active.length) {
    const grow = active.reduce(
      (sum, index) => sum + tracks[index].grow,
      0
    );
    let consumed = 0;
    const next = [];
    active.forEach((index) => {
      const track = tracks[index];
      const addition = Math.min(
        remaining * track.grow / grow,
        (track.max ?? Infinity) - sizes[index]
      );
      sizes[index] = sizes[index] + addition;
      consumed += addition;
      if (sizes[index] < (track.max ?? Infinity)) next.push(index);
    });
    if (consumed <= Number.EPSILON) break;
    remaining -= consumed;
    active = next;
  }
  return sizes;
}
function fittedGap(total, requested, count) {
  if (count <= 1) return 0;
  return Math.min(
    requested,
    Math.max(0, (total - Number.EPSILON) / (count - 1))
  );
}
function trackOffsets(sizes, gap, origin) {
  let offset = origin;
  return sizes.map((size) => {
    const current = offset;
    offset += size + gap;
    return current;
  });
}
function validBounds(bounds) {
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    throw new TypeError("View layout bounds require finite x and y coordinates");
  }
  return {
    x: bounds.x,
    y: bounds.y,
    width: positiveFinite(bounds.width, "View layout bounds width"),
    height: positiveFinite(bounds.height, "View layout bounds height")
  };
}
function validId(value, label) {
  const id = value.trim();
  if (!id) throw new TypeError(`${label} requires a nonempty id`);
  return id;
}
function validAnchor(value) {
  const anchors = [
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
    "center"
  ];
  if (!anchors.includes(value)) {
    throw new TypeError(`Unknown view inset anchor "${String(value)}"`);
  }
  return value;
}
function positiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be positive and finite`);
  }
  return value;
}
function nonNegativeFinite(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be nonnegative and finite`);
  }
  return value;
}
function unique(values) {
  return [...new Set(values)];
}
export {
  fill,
  getViewLayoutMetadataInternal,
  grid,
  inset,
  layer,
  resolveViewLayoutInternal
};
