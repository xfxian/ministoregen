import { cutOutlines, pocketOutline } from '../../model/pockets';
import {
  evenOverhang, hasOverhang, normalizeOverhang, reachBox, reachOutline,
} from '../../model/reach';

const EXACT = { baseClearance: 0, curvature: 0.55 };

export function baseLabel(model) {
  if (model.shape === 'round') return `Ø${model.sizeX}`;
  return `${model.sizeX} × ${model.sizeY}`;
}

/**
 * A base drawn like a sketch with a dimension line across it, and a dotted outline
 * for a model that reaches past its base. When it reaches further one way, a small
 * mark shows where the model faces. Bases up to 56 mm share one scale, so a 25 mm
 * base looks smaller than a 40 mm one; larger bases fill the box. A model without a
 * base shows its footprint outline and the touchpoints in it.
 */
function BaseSketch({ model, height = 88 }) {
  const overhang = normalizeOverhang(model.overhang);
  const { x0, x1, y0, y1 } = reachBox(model, EXACT);
  // Centred on the base, so the box must hold the further side twice.
  const side = Math.max(64, 2 * Math.max(-x0, x1, -y0, y1) + 8);
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`;
  const d = path(pocketOutline(model, EXACT, 48));
  const plain = { ...model, notches: false };
  const reach = hasOverhang(overhang) ? path(reachOutline(plain, EXACT, 48)) : null;
  const pads = model.shape === 'pads' ? cutOutlines(plain, EXACT, 48).map(path) : null;
  const front = model.sizeY / 2;
  return (
    <svg viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} height={height} width="100%" aria-hidden="true" style={{ display: 'block' }}>
      {reach && <path d={reach} fill={model.color} fillOpacity={0.06} stroke={model.color} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
      {!evenOverhang(overhang) && (
        <path d={`M-3,${-front + 4}L0,${-front + 1}L3,${-front + 4}`} fill="none" stroke={model.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
      {pads ? (
        <>
          <path d={d} fill="none" stroke={model.color} strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {pads.map((p, i) => <path key={i} d={p} fill={model.color} fillOpacity={0.2} stroke={model.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
        </>
      ) : (
        <path d={d} fill={model.color} fillOpacity={0.1} stroke={model.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
      <line x1={-model.sizeX / 2} x2={model.sizeX / 2} y1={0} y2={0} stroke={model.color} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default BaseSketch;
