import { arc as createArc } from "d3-shape";
import { isFiniteNumber, isNonnegativeFiniteNumber } from "./mark.js";
const tau = Math.PI * 2;
let polarSectorArc;
function resolvePolarSector(sector) {
  if (!isFiniteNumber(sector.startAngle) || !isFiniteNumber(sector.endAngle) || !isNonnegativeFiniteNumber(sector.innerRadius) || !isNonnegativeFiniteNumber(sector.outerRadius) || !isNonnegativeFiniteNumber(sector.cornerRadius)) {
    return void 0;
  }
  const generator = polarSectorArc ??= createArc().startAngle((value) => value.startAngle).endAngle((value) => value.endAngle).innerRadius((value) => value.innerRadius).outerRadius((value) => value.outerRadius).cornerRadius((value) => value.cornerRadius);
  const path = generator(sector);
  if (typeof path !== "string" || !path) return void 0;
  return { path, points: polarSectorBoundary(generator, sector) };
}
function polarSectorBoundary(generator, sector) {
  const points = [];
  const append = (x, y) => {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
    const previous = points.at(-1);
    if (previous && Math.abs(previous[0] - x) <= 1e-9 && Math.abs(previous[1] - y) <= 1e-9) {
      return;
    }
    points.push([x, y]);
  };
  const context = {
    moveTo: append,
    lineTo: append,
    arc(centerX, centerY, radius, startAngle, endAngle, counterclockwise = false) {
      const sweep = canvasArcSweep(startAngle, endAngle, counterclockwise);
      if (!isFiniteNumber(sweep)) return;
      if (sweep === 0) {
        append(
          centerX + radius * Math.cos(startAngle),
          centerY + radius * Math.sin(startAngle)
        );
        return;
      }
      const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
      for (let index = 0; index <= steps; index += 1) {
        const angle = startAngle + sweep * index / steps;
        append(
          centerX + radius * Math.cos(angle),
          centerY + radius * Math.sin(angle)
        );
      }
    },
    closePath() {
    }
  };
  const previousContext = generator.context();
  generator.context(context);
  try {
    generator(sector);
  } finally {
    generator.context(previousContext);
  }
  return points;
}
function canvasArcSweep(startAngle, endAngle, counterclockwise) {
  const difference = endAngle - startAngle;
  if (!isFiniteNumber(difference)) return Number.NaN;
  if (counterclockwise) {
    if (difference <= -tau) return -tau;
    const sweep2 = difference % tau;
    return sweep2 > 0 ? sweep2 - tau : sweep2;
  }
  if (difference >= tau) return tau;
  const sweep = difference % tau;
  return sweep < 0 ? sweep + tau : sweep;
}
export {
  resolvePolarSector
};
