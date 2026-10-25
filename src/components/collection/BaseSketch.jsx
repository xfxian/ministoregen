import { pocketOutline } from '../../model/pockets';

const EXACT = { baseClearance: 0, curvature: 0.55 };

export function baseLabel(unit) {
  if (unit.shape === 'round') return `Ø${unit.sizeX}`;
  return `${unit.sizeX} × ${unit.sizeY}`;
}

/**
 * A base drawn like a sketch with a dimension line across it, and a dotted outline
 * for a model that reaches past its base. Bases up to 56 mm share
 * one scale, so a 25 mm base looks smaller than a 40 mm one; larger bases fill the box.
 */
function BaseSketch({ unit, height = 88 }) {
  const overhang = unit.overhang ?? 0;
  const side = Math.max(64, Math.max(unit.sizeX, unit.sizeY) + 2 * overhang + 8);
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`;
  const d = path(pocketOutline(unit, EXACT, 48));
  const reach = overhang > 0
    ? path(pocketOutline({ ...unit, sizeX: unit.sizeX + 2 * overhang, sizeY: unit.sizeY + 2 * overhang }, EXACT, 48))
    : null;
  return (
    <svg viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} height={height} width="100%" aria-hidden="true" style={{ display: 'block' }}>
      {reach && <path d={reach} fill="none" stroke={unit.color} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />}
      <path d={d} fill={unit.color} fillOpacity={0.1} stroke={unit.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={-unit.sizeX / 2} x2={unit.sizeX / 2} y1={0} y2={0} stroke={unit.color} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default BaseSketch;
