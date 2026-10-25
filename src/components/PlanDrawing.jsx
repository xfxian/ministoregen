import { GRID_PITCH, LIP_DEPTH, OUTER_RADIUS, outerSize } from '../geometry/gridfinity';
import { placeOutline, pocketOutline } from '../model/pockets';
import { tokens } from '../theme';

const fmt = (mm) => (Math.round(mm * 10) / 10).toString();

function outlinePath(points) {
  // Model Y points up; SVG Y points down.
  return `M${points.map(([px, py]) => `${px.toFixed(2)},${(-py).toFixed(2)}`).join('L')}Z`;
}

/** The group as wide as the model reaches, for drawing its overhang. */
const grown = (g) => ({ ...g, sizeX: g.sizeX + 2 * g.overhang, sizeY: g.sizeY + 2 * g.overhang });

function roundedRect(w, h, r, props) {
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.max(0, r)} {...props} />;
}

/**
 * Top view of a bin as a technical drawing: outline, lip opening, grid cells and every
 * pocket in its group colour (spare pockets dashed, overhangs dotted). `detailed` adds dimension lines.
 * `maxPxPerMm` stops small bins from being blown up to fill a large container.
 */
function PlanDrawing({ project, plan, detailed = false, highlightId = null, label, maxPxPerMm }) {
  const W = outerSize(plan.unitsX);
  const L = outerSize(plan.unitsY);
  const pad = detailed ? Math.max(W, L) * 0.1 + 6 : 3;
  const font = Math.max(W, L) * 0.04 + 2;
  const stroke = { vectorEffect: 'non-scaling-stroke', fill: 'none' };
  const gridX = Array.from({ length: plan.unitsX - 1 }, (_, i) => (i + 1 - plan.unitsX / 2) * GRID_PITCH);
  const gridY = Array.from({ length: plan.unitsY - 1 }, (_, i) => (i + 1 - plan.unitsY / 2) * GRID_PITCH);
  const left = -W / 2 - pad;
  const top = -L / 2 - pad;

  return (
    <svg
      viewBox={`${left} ${top} ${W + 2 * pad} ${L + 2 * pad}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        ...(maxPxPerMm && { maxWidth: (W + 2 * pad) * maxPxPerMm, maxHeight: (L + 2 * pad) * maxPxPerMm }),
      }}
      role="img"
      aria-label={label ?? `Top view: ${plan.unitsX} by ${plan.unitsY} grid cells`}
    >
      {roundedRect(W, L, OUTER_RADIUS, { ...stroke, stroke: tokens.drawing, strokeWidth: 1.5 })}
      {project.bin.lip && roundedRect(W - 2 * LIP_DEPTH, L - 2 * LIP_DEPTH, OUTER_RADIUS - LIP_DEPTH, {
        ...stroke, stroke: tokens.drawing, strokeOpacity: 0.45, strokeWidth: 1, strokeDasharray: '5 4',
      })}
      {plan.inlay && roundedRect(plan.inlay.width, plan.inlay.length, plan.inlay.cornerRadius, {
        ...stroke, stroke: tokens.drawing, strokeOpacity: 0.3, strokeWidth: 1,
      })}
      <g style={{ ...stroke, stroke: tokens.drawing }} strokeOpacity={0.22} strokeWidth={1} strokeDasharray="1 5">
        {gridX.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={-L / 2} y2={L / 2} />)}
        {gridY.map((y) => <line key={`y${y}`} y1={-y} y2={-y} x1={-W / 2} x2={W / 2} />)}
      </g>
      {plan.strips.map(({ group, positions }) => {
        const outline = pocketOutline(group, project.layout, 32);
        const reach = group.overhang > 0 ? pocketOutline(grown(group), project.layout, 32) : null;
        const dim = highlightId && highlightId !== group.id;
        return (
          <g key={group.id} opacity={dim ? 0.3 : 1}>
            {reach && positions.slice(0, group.count).map((position) => (
              <path
                key={`reach${position[0]},${position[1]}`}
                d={outlinePath(placeOutline(reach, position))}
                style={stroke}
                stroke={group.color}
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="1 3"
              />
            ))}
            {positions.map((position, i) => {
              const spare = i >= group.count;
              return (
                <path
                  key={`${position[0]},${position[1]}`}
                  d={outlinePath(placeOutline(outline, position))}
                  style={stroke}
                  fill={spare ? 'none' : group.color}
                  fillOpacity={spare ? 0 : 0.14}
                  stroke={group.color}
                  strokeOpacity={spare ? 0.45 : 1}
                  strokeWidth={detailed ? 1.5 : 1.2}
                  strokeDasharray={spare ? '3 3' : undefined}
                />
              );
            })}
          </g>
        );
      })}
      {detailed && (
        <g fill={tokens.text} fontFamily={tokens.mono} fontSize={font} textAnchor="middle">
          <g style={{ ...stroke, stroke: tokens.drawing }} strokeWidth={1} strokeOpacity={0.8}>
            <line x1={-W / 2} x2={W / 2} y1={top + pad * 0.55} y2={top + pad * 0.55} />
            <line x1={-W / 2} x2={-W / 2} y1={top + pad * 0.3} y2={-L / 2 - 1} />
            <line x1={W / 2} x2={W / 2} y1={top + pad * 0.3} y2={-L / 2 - 1} />
            <line y1={-L / 2} y2={L / 2} x1={left + pad * 0.55} x2={left + pad * 0.55} />
            <line y1={-L / 2} y2={-L / 2} x1={left + pad * 0.3} x2={-W / 2 - 1} />
            <line y1={L / 2} y2={L / 2} x1={left + pad * 0.3} x2={-W / 2 - 1} />
          </g>
          <text x={0} y={top + pad * 0.55 - font * 0.45} paintOrder="stroke" stroke={tokens.bg} strokeWidth={font * 0.5}>{fmt(W)}</text>
          <text
            x={left + pad * 0.55 - font * 0.45}
            y={0}
            transform={`rotate(-90 ${left + pad * 0.55 - font * 0.45} 0)`}
            paintOrder="stroke"
            stroke={tokens.bg}
            strokeWidth={font * 0.5}
          >
            {fmt(L)}
          </text>
        </g>
      )}
    </svg>
  );
}

export default PlanDrawing;
