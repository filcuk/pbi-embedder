import { dodgeOffsets } from "./dodge-internal.js";
import { resolveDotLayout } from "./dot-layout.js";
import { isChartValue } from "./mark.js";
function createDotLayout(options) {
  if (options.axis !== "x" && options.axis !== "y") {
    throw new TypeError(
      `createDotLayout: unknown axis "${String(options.axis)}"`
    );
  }
  if (typeof options.resolve !== "function") {
    throw new TypeError("createDotLayout: resolve must be a function");
  }
  if (!isChartValue(options.anchor)) {
    throw new TypeError(
      "createDotLayout: anchor must be a string, finite number, or valid Date"
    );
  }
  return {
    axis: options.axis,
    anchor: options.anchor,
    [resolveDotLayout]: options.resolve
  };
}
function dodgeX(options = {}) {
  const anchor = options.anchor ?? "left";
  const padding = validPadding(options.padding);
  if (anchor !== "left" && anchor !== "middle" && anchor !== "right") {
    throw new TypeError(`dodgeX: unknown anchor "${String(anchor)}"`);
  }
  return {
    axis: "x",
    anchor,
    [resolveDotLayout]: ({ chart, measuredPositions, radii }) => {
      const edgeAnchored = anchor !== "middle";
      const offsets = dodgeOffsets(
        measuredPositions,
        radii,
        padding,
        edgeAnchored
      );
      const baseline = anchor === "left" ? chart.x : anchor === "right" ? chart.x + chart.width : chart.x + chart.width / 2;
      const direction = anchor === "right" ? -1 : 1;
      return offsets.map((offset) => baseline + offset * direction);
    }
  };
}
function dodgeY(options = {}) {
  const anchor = options.anchor ?? "bottom";
  const padding = validPadding(options.padding);
  if (anchor !== "top" && anchor !== "middle" && anchor !== "bottom") {
    throw new TypeError(`dodgeY: unknown anchor "${String(anchor)}"`);
  }
  return {
    axis: "y",
    anchor,
    [resolveDotLayout]: ({ chart, measuredPositions, radii }) => {
      const edgeAnchored = anchor !== "middle";
      const offsets = dodgeOffsets(
        measuredPositions,
        radii,
        padding,
        edgeAnchored
      );
      const baseline = anchor === "top" ? chart.y : anchor === "bottom" ? chart.y + chart.height : chart.y + chart.height / 2;
      const direction = anchor === "bottom" ? -1 : 1;
      return offsets.map((offset) => baseline + offset * direction);
    }
  };
}
function validPadding(padding) {
  const resolved = padding ?? 1;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new TypeError("dodge: padding must be a nonnegative finite number");
  }
  return resolved;
}
export {
  createDotLayout,
  dodgeX,
  dodgeY
};
