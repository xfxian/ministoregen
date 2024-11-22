import * as THREE from 'three';
import { Line2 } from 'three-stdlib';

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
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 */
function circle(x, y, radius) {
    const hole = new THREE.Shape();

    hole.absarc(x, y, radius, 0, Math.PI * 2, false);

    return hole;
}

/**
 * Generates a hexagonal pattern of holes within the inlay.
 * @param {number} length - Length of the inlay.
 * @param {number} width - Width of the inlay.
 * @param {number} baseSize - Diameter of each hole.
 * @param {number} margin - Optional margin from the inlay edges.
 * @returns {number[][]} - Array of hole positions.
 */
function hexagonalLayout(length, width, margin, baseSize, baseSpacing, baseClearance) {
    const holes = [];
    const holeDiameter = baseSize + baseClearance;

    // Calculate optimal hexagon size to prevent overlapping
    const s = holeDiameter / Math.sqrt(3);

    // Calculate spacing based on hexagonal packing
    const colSpacing = holeDiameter + (baseSpacing / 2); // Horizontal distance between centers
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
    const xOffset = (width - patternWidth) / 2;
    const yOffset = (length - patternHeight) / 2;

    console.debug(`Rows: ${numRows}, Columns: ${numCols}`)

    if (numRows < 4 && numCols < 2) {
        console.debug("Special handling for two holes or less");

        for (let row = 0; row < numRows; row++) {
            const x = -width / 2 + xOffset + colSpacing / 2;
            const y = -length / 2 + row * rowHeight + yOffset + rowHeight / 2;
            holes.push([x, y]);
        }
    } else {
        for (let row = 0; row < numRows; row++) {
            const isOddRow = row % 2 === 1;

            const rowOffset = isOddRow ? 0 : colSpacing / 2;

            for (let col = 0; col < numCols; col++) {
                const x = -width / 2 + col * colSpacing + rowOffset + xOffset;
                const y = -length / 2 + row * rowHeight + yOffset + rowHeight / 2;

                // Skip first hole of every odd row
                if (!(isOddRow && col === 0))
                    holes.push([x, y]);
            }
        }
    }

    console.debug(`Holes: ${holes.length}`)

    return holes;
}

function Inlay({ modelRef, modelConfig, previewConfig }) {
    const { inlay, base } = modelConfig;

    const lengthWithClearance = inlay.length - inlay.clearance;
    const widthWithClearance = inlay.width - inlay.clearance;

    // Inlay

    const inlayShape = roundedRect(lengthWithClearance, widthWithClearance, inlay.cornerRadius);
    const holePositions = hexagonalLayout(lengthWithClearance, widthWithClearance, inlay.margin, base.size, base.spacing, base.clearance);
    inlayShape.holes = holePositions.map(([x, y]) => circle(x, y, base.size / 2))

    const extrudeSettings = { steps: 4, depth: inlay.depth, curveSegments: 64, bevelEnabled: false };

    // Visualization

    const marginShape = roundedRect(lengthWithClearance - (inlay.margin * 2), widthWithClearance - (inlay.margin * 2), inlay.cornerRadius);
    const marginGeometry = new THREE.BufferGeometry().setFromPoints(marginShape.getPoints());

    const spacingGeometries = holePositions.map(([x, y]) => {
        const spacingShape = circle(x, y, (base.size / 2) + (base.spacing / 2))
        return new THREE.BufferGeometry().setFromPoints(spacingShape.getPoints(64));
    });

    return (
        <group>
            <mesh ref={modelRef} position={[0, 0, 0]}>
                <extrudeGeometry args={[inlayShape, extrudeSettings]} />
                <meshPhysicalMaterial wireframe={previewConfig.wireframe} color={previewConfig.color} clearcoat={0.5} clearcoatRoughness={0.4} reflectivity={0.25} />
            </mesh>
            <line geometry={marginGeometry} position={[0, 0, inlay.depth + 0.1]}>
                <lineDashedMaterial color={'blue'} dashSize={20} gapSize={5} linewidth={1} />
            </line>
            {spacingGeometries.map(spacingGeometry => (
                <line geometry={spacingGeometry} position={[0, 0, inlay.depth + 0.1]}>
                    <lineDashedMaterial color={'green'} />
                </line>
            ))}
        </group>
    );
}

export default Inlay;