import * as THREE from 'three';

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
 * @returns {THREE.Shape} - The generated ellipse shape.
 */
function ellipse(x, y, radiusX, radiusY) {
    const hole = new THREE.Shape();

    // Create an absolute ellipse path
    hole.absellipse(x, y, radiusX, radiusY, 0, Math.PI * 2, false);

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

    console.debug(`Rows: ${numRows}, Columns: ${numCols}`)

    if (numCols == 1) {
        console.debug("Special handling for single column");
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

    console.debug(`Holes: ${holes.length}`)

    return holes;
}

function Inlay({ modelRef, modelConfig, previewConfig }) {
    const { inlay, base } = modelConfig;

    const lengthWithClearance = inlay.length - inlay.clearance;
    const widthWithClearance = inlay.width - inlay.clearance;

    // Inlay

    const inlayShape = roundedRect(lengthWithClearance, widthWithClearance, inlay.cornerRadius);

    base.sections.flatMap((section, index) => {
        console.debug(`Section #${index + 1}`);
        const lengthWithClearanceAndMargin = lengthWithClearance - inlay.margin * 2;
        console.debug(`Length with clearance ${lengthWithClearance} and margin ${lengthWithClearanceAndMargin}`);
        console.debug(`Base share: ${section.share}`);
        const lengthWithShare = (section.share * lengthWithClearanceAndMargin) / 100;
        console.debug(`Length with share ${lengthWithShare}`);
        const accumulatedYPercentage = base.sections
            .map((section, index) => { console.log(`Section ${index}: ${section.share}`); return section.share })
            .reduce((prev, curr, i) => { console.log(`Prev ${prev}`); return (i < index ? prev + curr : prev) }, 0);
        const accumulatedYOffset = (accumulatedYPercentage * lengthWithClearanceAndMargin) / 100;
        console.debug(`Accumulated Y Percentage: ${accumulatedYPercentage}, Offset: ${accumulatedYOffset}`);

        const sectionYOffset = (-lengthWithClearanceAndMargin / 2) + accumulatedYOffset + (lengthWithShare / 2);

        const widthWithshare = widthWithClearance
        const holePositions = hexagonalLayout(lengthWithShare, widthWithshare, inlay.margin, section.sizeX, section.sizeY, section.spacing, section.clearance, 0, sectionYOffset)
        inlayShape.holes = inlayShape.holes.concat(holePositions.map(([x, y]) => ellipse(x, y, section.sizeX / 2, section.sizeY / 2)));
    });

    const extrudeSettings = { steps: 4, depth: inlay.depth, curveSegments: 64, bevelEnabled: false };

    // Visualization

    const marginShape = roundedRect(lengthWithClearance - (inlay.margin * 2), widthWithClearance - (inlay.margin * 2), inlay.cornerRadius);
    const marginGeometry = new THREE.BufferGeometry().setFromPoints(marginShape.getPoints());

    // const spacingGeometries = holePositions.map(([x, y]) => {
    //     const spacingShape = circle(x, y, (base.size / 2) + (base.spacing / 2))
    //     return new THREE.BufferGeometry().setFromPoints(spacingShape.getPoints(64));
    // });

    return (
        <group>
            <mesh ref={modelRef} position={[0, 0, 0]}>
                <extrudeGeometry args={[inlayShape, extrudeSettings]} />
                <meshPhysicalMaterial wireframe={previewConfig.wireframe} color={previewConfig.color} clearcoat={0.5} clearcoatRoughness={0.4} reflectivity={0.25} />
            </mesh>
            <line geometry={marginGeometry} position={[0, 0, inlay.depth + 0.1]}>
                <lineDashedMaterial color={'blue'} dashSize={20} gapSize={5} linewidth={1} />
            </line>
            {/* {spacingGeometries.map(spacingGeometry => (
                <line geometry={spacingGeometry} position={[0, 0, inlay.depth + 0.1]}>
                    <lineDashedMaterial color={'green'} />
                </line>
            ))} */}
        </group>
    );
}

export default Inlay;