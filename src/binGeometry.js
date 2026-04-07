import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const STACKING_LIP_WIDTH = 2.15;
export const STACKING_LIP_HEIGHT = 2.15;

/**
 * Rounded rectangle as a THREE.Shape (counter-clockwise winding — outer boundary).
 */
function roundedRectShape(length, width, cornerRadius) {
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
 * Rounded rectangle as a THREE.Path (clockwise winding — for use as a shape hole).
 */
function roundedRectPath(length, width, cornerRadius) {
    const path = new THREE.Path();
    path.moveTo(-(width / 2), -(length / 2) + cornerRadius);
    // CW direction (opposite of CCW outer shape): go down-right first
    path.arc(cornerRadius, 0, cornerRadius, Math.PI, -(Math.PI / 2), false);
    path.lineTo(width / 2 - cornerRadius, -(length / 2));
    path.arc(0, cornerRadius, cornerRadius, -(Math.PI / 2), 0, false);
    path.lineTo(width / 2, length / 2 - cornerRadius);
    path.arc(-cornerRadius, 0, cornerRadius, 0, Math.PI / 2, false);
    path.lineTo(-(width / 2) + cornerRadius, length / 2);
    path.arc(0, -cornerRadius, cornerRadius, Math.PI / 2, Math.PI, false);
    return path;
}

export function buildFloorGeometry(outerL, outerW, cornerRadius, floorThickness) {
    const shape = roundedRectShape(outerL, outerW, cornerRadius);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: floorThickness, bevelEnabled: false });
    return geo;
}

export function buildWallsGeometry(outerL, outerW, innerL, innerW, outerCornerRadius, innerCornerRadius, wallHeight) {
    const shape = roundedRectShape(outerL, outerW, outerCornerRadius);
    shape.holes = [roundedRectPath(innerL, innerW, innerCornerRadius)];
    const geo = new THREE.ExtrudeGeometry(shape, { depth: wallHeight, curveSegments: 32, bevelEnabled: false });
    return geo;
}

export function buildBaseRingGeometry(outerL, outerW, outerCornerRadius, innerL, innerW, innerCornerRadius) {
    const shape = roundedRectShape(outerL, outerW, outerCornerRadius);
    shape.holes = [roundedRectPath(innerL, innerW, innerCornerRadius)];
    const geo = new THREE.ExtrudeGeometry(shape, { depth: STACKING_LIP_HEIGHT, curveSegments: 32, bevelEnabled: false });
    return geo;
}

export function buildStackingLipGeometry(outerL, outerW, cornerRadius) {
    const lipInnerL = outerL - STACKING_LIP_WIDTH * 2;
    const lipInnerW = outerW - STACKING_LIP_WIDTH * 2;
    const lipInnerRadius = Math.max(0, cornerRadius - STACKING_LIP_WIDTH);
    const shape = roundedRectShape(outerL, outerW, cornerRadius);
    shape.holes = [roundedRectPath(lipInnerL, lipInnerW, lipInnerRadius)];
    const geo = new THREE.ExtrudeGeometry(shape, { depth: STACKING_LIP_HEIGHT, curveSegments: 32, bevelEnabled: false });
    return geo;
}

/**
 * Builds the complete bin geometry from binConfig and inlayConfig.
 * Returns a merged THREE.BufferGeometry ready for export or preview.
 */
export function buildBinGeometry(binConfig, inlayConfig) {
    const { wallThickness, floorThickness, heightMm, stackingLip } = binConfig;
    const innerL = inlayConfig.length;
    const innerW = inlayConfig.width;
    const innerCornerRadius = inlayConfig.cornerRadius;
    const outerL = innerL + 2 * wallThickness;
    const outerW = innerW + 2 * wallThickness;
    const outerCornerRadius = innerCornerRadius + wallThickness;

    // Wall height is total bin height minus base ring, floor thickness (and minus lip if stacking)
    const wallHeight = heightMm - STACKING_LIP_HEIGHT - floorThickness - (stackingLip ? STACKING_LIP_HEIGHT : 0);

    // Base ring at Z=0: outer walls extend below the floor to create the gridfinity stacking socket
    const baseRingGeo = buildBaseRingGeometry(outerL, outerW, outerCornerRadius, innerL, innerW, innerCornerRadius);

    // Floor sits on top of the base ring
    const floorGeo = buildFloorGeometry(outerL, outerW, outerCornerRadius, floorThickness);
    floorGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, STACKING_LIP_HEIGHT));

    // Walls start above the floor
    const wallsGeo = buildWallsGeometry(outerL, outerW, innerL, innerW, outerCornerRadius, innerCornerRadius, wallHeight);
    wallsGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, STACKING_LIP_HEIGHT + floorThickness));

    const geometries = [baseRingGeo, floorGeo, wallsGeo];

    if (stackingLip) {
        const lipGeo = buildStackingLipGeometry(outerL, outerW, outerCornerRadius);
        lipGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, STACKING_LIP_HEIGHT + floorThickness + wallHeight));
        geometries.push(lipGeo);
    }

    return mergeGeometries(geometries);
}
