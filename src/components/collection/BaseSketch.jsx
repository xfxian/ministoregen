import { pocketOutline } from '../../model/pockets';

const EXACT = { baseClearance: 0, curvature: 0.55 };

export function baseLabel(model) {
  if (model.shape === 'round') return `Ø${model.sizeX}`;
  return `${model.sizeX} × ${model.sizeY}`;
}

/**
 * A base drawn like a sketch with a dimension line across it, and a dotted outline
 * for a model that reaches past its base. Bases up to 56 mm share
 * one scale, so a 25 mm base looks smaller than a 40 mm one; larger bases fill the box.
 */
function BaseSketch({ model, height = 88 }) {
  const overhang = model.overhang ?? 0;
  const side = Math.max(64, Math.max(model.sizeX, model.sizeY) + 2 * overhang + 8);
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`;
  const d = path(pocketOutline(model, EXACT, 48));
  const reach = overhang > 0
    ? path(pocketOutline({ ...model, sizeX: model.sizeX + 2 * overhang, sizeY: model.sizeY + 2 * overhang }, EXACT, 48))
    : null;
  return (
    <svg viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} height={height} width="100%" aria-hidden="true" style={{ display: 'block' }}>
      {reach && <path d={reach} fill="none" stroke={model.color} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />}
      <path d={d} fill={model.color} fillOpacity={0.1} stroke={model.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={-model.sizeX / 2} x2={model.sizeX / 2} y1={0} y2={0} stroke={model.color} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default BaseSketch;
