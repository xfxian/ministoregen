/**
 * Upper bound for how large the plan, 3D and cut views draw a bin, in screen pixels per
 * millimetre. Without it a 1x1 bin fills a big monitor; larger bins are unaffected.
 */
export const MAX_PX_PER_MM = 8;

/** Zoom speed for one 100 px wheel step; OrbitControls turns a speed of 1 into 5 %. */
const ZOOM_PER_100PX = 1;

/** Caps a single event so a fast flick or a coarse wheel never jumps more than ~10 %. */
const MAX_ZOOM_SPEED = 2;

/**
 * OrbitControls from three-stdlib zooms by a fixed 5 % per wheel event, whatever the
 * scroll distance. Browsers with smooth scrolling and trackpads fire many events per
 * gesture, so one wheel click can zoom by a third. This returns a zoom speed that scales
 * with the scrolled distance instead, normalised to pixels like three.js does.
 */
export function wheelZoomSpeed({ deltaY, deltaMode = 0, ctrlKey = false }) {
  let px = Math.abs(deltaY);
  if (deltaMode === 1) px *= 16; // lines
  else if (deltaMode === 2) px *= 100; // pages
  if (ctrlKey) px *= 10; // trackpad pinch reports tiny deltas
  return Math.min(MAX_ZOOM_SPEED, (px / 100) * ZOOM_PER_100PX);
}

/**
 * Camera distance at which an object at the target is drawn with at most
 * MAX_PX_PER_MM, for a perspective camera with vertical `fovDeg` on a canvas
 * `heightPx` tall.
 */
export function minDistanceForScale(fovDeg, heightPx, maxPxPerMm = MAX_PX_PER_MM) {
  return heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360) * maxPxPerMm);
}
