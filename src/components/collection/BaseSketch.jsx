import { pocketOutline } from '../../model/pockets';

const EXACT = { baseClearance: 0, curvature: 0.55 };

export function baseLabel(unit) {
  if (unit.shape === 'round') return `Ø${unit.sizeX}`;
  return `${unit.sizeX} × ${unit.sizeY}`;
}

/**
 * A base drawn like a sketch with a dimension line across it. Bases up to 56 mm share
 * one scale, so a 25 mm base looks smaller than a 40 mm one; larger bases fill the box.
 */
function BaseSketch({ unit, height = 88 }) {
  const side = Math.max(64, Math.max(unit.sizeX, unit.sizeY) + 8);
  const points = pocketOutline(unit, EXACT, 48);
  const d = `M${points.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`;
  return (
    <svg viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} height={height} width="100%" aria-hidden="true" style={{ display: 'block' }}>
      <path d={d} fill={unit.color} fillOpacity={0.1} stroke={unit.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={-unit.sizeX / 2} x2={unit.sizeX / 2} y1={0} y2={0} stroke={unit.color} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default BaseSketch;
