/**
 * Horizontal SVG visualization of inlay sections as proportional vertical strips.
 * Clicking a strip selects it (highlights both here and in the 3D view).
 */
function SectionViz({ sections, selectedSection, onSelectSection }) {
  const HEIGHT = 72;
  const BORDER_RADIUS = 5;

  const totalShare = sections.reduce((sum, s) => sum + s.share, 0);

  const strips = sections.map((section, i) => {
    const accumulatedShare = sections.slice(0, i).reduce((sum, s) => sum + s.share, 0);
    const x = (accumulatedShare / totalShare) * 100;
    const w = (section.share / totalShare) * 100;
    return { index: i, x, w, share: section.share };
  });

  return (
    <svg
      width="100%"
      viewBox={`0 0 100 ${HEIGHT}`}
      preserveAspectRatio="none"
      style={{
        display: 'block',
        borderRadius: BORDER_RADIUS,
        border: '1px solid rgba(255,255,255,0.12)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <defs>
        <clipPath id="inlay-clip-h">
          <rect x="0" y="0" width="100" height={HEIGHT} rx={BORDER_RADIUS} ry={BORDER_RADIUS} />
        </clipPath>
      </defs>

      <g clipPath="url(#inlay-clip-h)">
        {strips.map(({ index, x, w }) => {
          const isSelected = index === selectedSection;
          return (
            <g
              key={index}
              onClick={() => onSelectSection(isSelected ? null : index)}
            >
              {/* Strip background */}
              <rect
                x={x}
                y={0}
                width={w}
                height={HEIGHT}
                fill={isSelected ? 'rgba(33, 150, 243, 0.30)' : 'rgba(255,255,255,0.04)'}
              />
              {/* Divider line (skip first) */}
              {index > 0 && (
                <line
                  x1={x} y1={0}
                  x2={x} y2={HEIGHT}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={0.5}
                />
              )}
              {/* Top accent bar when selected */}
              {isSelected && (
                <rect x={x} y={0} width={w} height={2.5} fill="#2196f3" />
              )}
              {/* Label — two lines if narrow */}
              {w > 12 ? (
                <>
                  <text
                    x={x + w / 2}
                    y={HEIGHT / 2 - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={w > 25 ? 8 : 7}
                    fill={isSelected ? '#90caf9' : 'rgba(255,255,255,0.6)'}
                    fontFamily="sans-serif"
                    fontWeight={isSelected ? '600' : '400'}
                  >
                    {`S${index + 1}`}
                  </text>
                  <text
                    x={x + w / 2}
                    y={HEIGHT / 2 + 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={w > 25 ? 7 : 6}
                    fill={isSelected ? '#90caf9' : 'rgba(255,255,255,0.45)'}
                    fontFamily="sans-serif"
                  >
                    {`${sections[index].share.toFixed(0)}%`}
                  </text>
                </>
              ) : (
                <text
                  x={x + w / 2}
                  y={HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={6}
                  fill={isSelected ? '#90caf9' : 'rgba(255,255,255,0.5)'}
                  fontFamily="sans-serif"
                >
                  {`S${index + 1}`}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default SectionViz;
