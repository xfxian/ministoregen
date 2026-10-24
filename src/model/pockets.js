/**
 * 2D outline of one pocket, centred on the origin, as [x, y] points in
 * counter-clockwise order. Shared by the inlay and the floor pockets.
 */
export function pocketOutline(group, layout, segments = 64) {
  const rx = (group.sizeX + layout.baseClearance) / 2;
  const ry = (group.sizeY + layout.baseClearance) / 2;
  if (group.shape === 'square' || group.shape === 'rect') {
    return roundedRectOutline(rx, ry, Math.min(1, rx, ry), Math.max(2, Math.round(segments / 8)));
  }
  return bezierEllipseOutline(rx, ry, layout.curvature, Math.max(4, Math.round(segments / 4)));
}

// Four cubic Bézier quarters; a curvature of 0.55 approximates a true ellipse,
// lower values give flatter sides for oval bases that are not quite elliptical.
function bezierEllipseOutline(rx, ry, k, perQuarter) {
  const cx = rx * k;
  const cy = ry * k;
  const quarters = [
    [[rx, 0], [rx, cy], [cx, ry], [0, ry]],
    [[0, ry], [-cx, ry], [-rx, cy], [-rx, 0]],
    [[-rx, 0], [-rx, -cy], [-cx, -ry], [0, -ry]],
    [[0, -ry], [cx, -ry], [rx, -cy], [rx, 0]],
  ];
  const points = [];
  for (const [p0, p1, p2, p3] of quarters) {
    for (let i = 0; i < perQuarter; i++) {
      const t = i / perQuarter;
      const u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      points.push([
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      ]);
    }
  }
  return points;
}

function roundedRectOutline(rx, ry, r, perCorner) {
  const corners = [[rx - r, ry - r, 0], [-(rx - r), ry - r, 90], [-(rx - r), -(ry - r), 180], [rx - r, -(ry - r), 270]];
  const points = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = ((start + (90 * i) / perCorner) * Math.PI) / 180;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}
