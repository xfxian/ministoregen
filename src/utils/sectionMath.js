/**
 * Computes the 3D-space geometry for each section strip in the inlay.
 * Used by both the sidebar SVG visualization and the Inlay 3D highlight overlay.
 *
 * @param {object} inlay - The inlay config (length, width, clearance, margin)
 * @param {Array} sections - Array of section configs (each with a `share` percentage)
 * @returns {Array} strips - One entry per section with center Y and dimensions
 */
export function computeSectionStrips(inlay, sections) {
  const lengthWithClearance = inlay.length - inlay.clearance;
  const usableLength = lengthWithClearance - inlay.margin * 2;

  return sections.map((section, index) => {
    const stripLength = (section.share * usableLength) / 100;
    const accumulatedShare = sections
      .slice(0, index)
      .reduce((sum, s) => sum + s.share, 0);
    const accumulatedY = (accumulatedShare / 100) * usableLength;
    const centerY = -usableLength / 2 + accumulatedY + stripLength / 2;

    return {
      index,
      share: section.share,
      centerY,
      halfHeight: stripLength / 2,
      // Full usable width of the inlay (for overlay plane sizing)
      fullWidth: inlay.width - inlay.clearance,
    };
  });
}
