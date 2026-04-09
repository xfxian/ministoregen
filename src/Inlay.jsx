import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { computeSectionStrips } from './utils/sectionMath';

/**
 * @param {number} length
 * @param {number} width
 * @param {number} cornerRadius
 */
function roundedRect(length, width, cornerRadius) {
    const shape = new THREE.Shape();

    shape.moveTo(-(width / 2), -(length / 2) + cornerRadius);
    shape.lineTo(-(width / 2), length / 2 - cornerRadius);
    shape.arc(cornerRadius, 0, cornerRadius, Math.PI, Math.PI / 2, true);
    shape.lineTo(width / 2 - cornerRadius, length / 2);
    shape.arc(0, -cornerRadius, cornerRadius, Math.PI / 2, 0, true);
    shape.lineTo(width / 2, -(length / 2) + cornerRadius);
    shape.arc(-cornerRadius, 0, cornerRadius, 0, -(Math.PI / 2), true);
    shape.lineTo(-(width / 2) + cornerRadius, -(length / 2));
    shape.arc(0, cornerRadius, cornerRadius, -(Math.PI / 2), Math.PI, true);

    return shape;
}

/**
 * @param {number} x - The x-coordinate of the ellipse center.
 * @param {number} y - The y-coordinate of the ellipse center.
 * @param {number} radiusX - The horizontal radius of the ellipse.
 * @param {number} radiusY - The vertical radius of the ellipse.
 * @param {number} curvatureFactor - Factor to adjust curvature at the ends.
 * @returns {THREE.Shape} - The generated Bézier-based ellipse shape.
 */
function bezierEllipse(x, y, radiusX, radiusY, curvatureFactor = 0.55) {
    const hole = new THREE.Shape();

    // Calculate control points based on the curvature factor
    const cX = radiusX * curvatureFactor;
    const cY = radiusY * curvatureFactor;

    // Start at the top
    hole.moveTo(x, y + radiusY);

    // Top-left curve (Counter-Clockwise)
    hole.bezierCurveTo(x - cX, y + radiusY, x - radiusX, y + cY, x - radiusX, y);

    // Bottom-left curve
    hole.bezierCurveTo(x - radiusX, y - cY, x - cX, y - radiusY, x, y - radiusY);

    // Bottom-right curve
    hole.bezierCurveTo(x + cX, y - radiusY, x + radiusX, y - cY, x + radiusX, y);

    // Top-right curve
    hole.bezierCurveTo(x + radiusX, y + cY, x + cX, y + radiusY, x, y + radiusY);

    return hole;
}

/**
 * Generates a hexagonal pattern of holes within the inlay.
 * @param {number} length - Length of the inlay.
 * @param {number} width - Width of the inlay.
 * @param {number} baseSizeX - Width of each hole.
 * @param {number} baseSizeY - Length of each hole.
 * @param {number} margin - Optional margin from the inlay edges.
 * @returns {number[][]} - Array of hole positions.
 */
function hexagonalLayout(length, width, margin, baseSizeX, baseSizeY, baseSpacing, baseClearance, sectionXOffset = 0, sectionYOffset = 0) {
    const holes = [];
    const holeDiameterX = baseSizeX + baseClearance;
    const holeDiameterY = baseSizeY + baseClearance;

    // Calculate optimal hexagon size to prevent overlapping
    const s = holeDiameterY / Math.sqrt(3);

    // Calculate spacing based on hexagonal packing
    const colSpacing = holeDiameterX + (baseSpacing / 2); // Horizontal distance between centers
    const rowHeight = 1.5 * s + (baseSpacing / 2); // Vertical distance between centers (~0.866 * diameter)

    // Calculate usable dimensions considering margin
    const usableLength = length - 2 * margin;
    const usableWidth = width - 2 * margin;

    // Calculate the maximum number of rows and columns that fit within the usable space
    const numRows = Math.floor(usableLength / rowHeight);
    const numCols = Math.floor(usableWidth / colSpacing);

    // Calculate the actual pattern dimensions
    const patternHeight = numRows * rowHeight;
    const patternWidth = numCols * colSpacing;

    // Calculate offsets to center the pattern within the inlay
    const xOffset = (usableWidth - patternWidth) / 2 + sectionXOffset;
    const yOffset = (usableLength - patternHeight) / 2 + sectionYOffset;

    if (numCols === 1) {
        // Recalculate row height for single column
        const singleColumnRowHeight = holeDiameterY + (baseSpacing / 2)
        const singleColumnNumRows = Math.floor(usableLength / singleColumnRowHeight);
        const singleColumnPatternHeight = singleColumnNumRows * singleColumnRowHeight;
        const singleColumnYOffset = (usableLength - singleColumnPatternHeight) / 2 + sectionYOffset;

        for (let row = 0; row < singleColumnNumRows; row++) {
            const y = -usableLength / 2 + row * singleColumnRowHeight + singleColumnYOffset + singleColumnRowHeight / 2;
            holes.push([0, y]);
        }
    } else {
        for (let row = 0; row < numRows; row++) {
            const isOddRow = row % 2 === 1;

            const rowOffset = isOddRow ? 0 : colSpacing / 2;

            for (let col = 0; col < numCols; col++) {
                const x = -usableWidth / 2 + col * colSpacing + rowOffset + xOffset;
                const y = -usableLength / 2 + row * rowHeight + yOffset + rowHeight / 2;

                // Skip first hole of every odd row
                if (!(isOddRow && col === 0))
                    holes.push([x, y]);
            }
        }
    }

    return holes;
}

function Inlay({ modelRef, modelConfig, previewConfig, inlayZOffset, selectedSection, showMiniatureCylinders }) {
    const { inlay, base } = modelConfig;

    const lengthWithClearance = inlay.length - inlay.clearance;
    const widthWithClearance = inlay.width - inlay.clearance;

    // Inlay
    const inlayShape = roundedRect(lengthWithClearance, widthWithClearance, inlay.cornerRadius);

    // Compute section strips (shared math with SVG sidebar viz)
    const strips = computeSectionStrips(inlay, base.sections);

    base.sections.forEach((section, index) => {
        const { centerY, halfHeight } = strips[index];
        const stripLength = halfHeight * 2;

        const holePositions = hexagonalLayout(
            stripLength, widthWithClearance,
            inlay.margin, section.sizeX, section.sizeY,
            section.spacing, section.clearance,
            0, centerY
        );
        inlayShape.holes = inlayShape.holes.concat(
            holePositions.map(([x, y]) =>
                bezierEllipse(
                    x, y,
                    (section.sizeX / 2) + (section.clearance / 2),
                    (section.sizeY / 2) + (section.clearance / 2),
                    section.curvatureFactor
                )
            )
        );
    });

    const extrudeSettings = { steps: 4, depth: inlay.depth, curveSegments: 64, bevelEnabled: false };

    // Visualization
    const marginShape = roundedRect(lengthWithClearance - (inlay.margin * 2), widthWithClearance - (inlay.margin * 2), inlay.cornerRadius);
    const marginGeometry = new THREE.BufferGeometry().setFromPoints(marginShape.getPoints());

    // Selected section highlight
    const highlightStrip = selectedSection !== null ? strips[selectedSection] : null;

    return (
        <group>
            <mesh ref={modelRef} position={[0, 0, inlayZOffset]}>
                <extrudeGeometry args={[inlayShape, extrudeSettings]} />
                <meshPhysicalMaterial wireframe={previewConfig.wireframe} color={previewConfig.color} clearcoat={0.5} clearcoatRoughness={0.4} reflectivity={0.25} />
            </mesh>
            <line geometry={marginGeometry} position={[0, 0, inlayZOffset + inlay.depth + 0.1]}>
                <lineDashedMaterial color={'blue'} dashSize={20} gapSize={5} linewidth={1} />
            </line>

            {/* Section highlight overlay */}
            {highlightStrip && (
                <mesh position={[0, highlightStrip.centerY, inlayZOffset + inlay.depth + 0.05]}>
                    <planeGeometry args={[highlightStrip.fullWidth - inlay.margin * 2, highlightStrip.halfHeight * 2]} />
                    <meshBasicMaterial color="#2196f3" transparent opacity={0.35} depthWrite={false} />
                </mesh>
            )}

            {/* Miniature cylinder overlays */}
            {showMiniatureCylinders && base.sections.map((section, i) => {
                if (!section.miniatureHeightMm) return null;
                const { centerY, halfHeight } = strips[i];
                const positions = hexagonalLayout(
                    halfHeight * 2, widthWithClearance,
                    inlay.margin, section.sizeX, section.sizeY,
                    section.spacing, section.clearance,
                    0, centerY
                );
                if (positions.length === 0) return null;
                const radius = (Math.min(section.sizeX, section.sizeY) / 2) + (section.clearance / 2);
                const h = section.miniatureHeightMm;
                const cyls = positions.map(([x, y]) => {
                    const geo = new THREE.CylinderGeometry(radius, radius, h, 12);
                    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
                    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, inlayZOffset + inlay.depth + h / 2));
                    return geo;
                });
                const merged = mergeGeometries(cyls);
                if (!merged) return null;
                return (
                    <mesh key={`cyl-${i}`} geometry={merged}>
                        <meshPhysicalMaterial
                            color={section.color || '#e74c3c'}
                            transparent
                            opacity={0.55}
                            depthWrite={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

export default Inlay;
