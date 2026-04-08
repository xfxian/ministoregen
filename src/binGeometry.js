import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Gridfinity unit dimensions
const GRIDFINITY_UNIT = 42;           // mm per gridfinity unit

// Base foot dimensions (Gridfinity spec, per unit cell)
const FOOT_TOP_OUTER = 41.5;          // = GRIDFINITY_UNIT - 0.5mm spacer
const FOOT_MID_OUTER = 37.2;          // FOOT_TOP_OUTER - 4.3
const FOOT_BOT_OUTER = 35.6;          // FOOT_TOP_OUTER - 5.9
const FOOT_TOP_RADIUS = 3.75;
const FOOT_MID_RADIUS = 1.6;          // FOOT_TOP_RADIUS - 2.15
const FOOT_BOT_RADIUS = 0.8;          // FOOT_MID_RADIUS - 0.8
const BASE_BOTTOM_CHAMFER = 0.8;
const BASE_VERTICAL = 1.8;
const BASE_TOP_CHAMFER = 2.15;
export const BASE_HEIGHT = BASE_BOTTOM_CHAMFER + BASE_VERTICAL + BASE_TOP_CHAMFER; // 4.75mm

// Stacking lip dimensions (Gridfinity spec)
const LIP_OUTER_CLEARANCE = 0.25;    // inset per side from bin outer
const LIP_WIDTH = 2.15;              // ring width per side
export const LIP_HEIGHT = 4.4;

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

/**
 * Builds the side surface (no caps) of a lofted solid between two rounded rectangles.
 * Bottom profile at Z=0, top profile at Z=height.
 */
function buildTaperedRoundedRectGeometry(botL, botW, botR, topL, topW, topR, height) {
    const N = 128;
    const botPts = roundedRectShape(botL, botW, botR).getPoints(N); // N+1 points
    const topPts = roundedRectShape(topL, topW, topR).getPoints(N);

    const verts = [];
    const uvs = [];
    for (let i = 0; i <= N; i++) {
        const u = i / N;
        verts.push(botPts[i].x, botPts[i].y, 0);
        verts.push(topPts[i].x, topPts[i].y, height);
        uvs.push(u, 0);
        uvs.push(u, 1);
    }

    const indices = [];
    for (let i = 0; i < N; i++) {
        const b0 = i * 2, t0 = b0 + 1;
        const b1 = (i + 1) * 2, t1 = b1 + 1;
        // roundedRectShape traces CW, so winding must be (b0,t0,b1) for outward normals
        indices.push(b0, t0, b1);
        indices.push(b1, t0, t1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

/**
 * Builds a single 41.5×41.5mm gridfinity base foot (spec-compliant chamfered profile).
 * Centered at origin, base at Z=0, top at Z=BASE_HEIGHT.
 */
function buildSingleBaseFootGeometry() {
    // Side surfaces for 3 sections
    const sec1 = buildTaperedRoundedRectGeometry(
        FOOT_BOT_OUTER, FOOT_BOT_OUTER, FOOT_BOT_RADIUS,
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        BASE_BOTTOM_CHAMFER
    );

    const sec2 = buildTaperedRoundedRectGeometry(
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        BASE_VERTICAL
    );
    sec2.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_BOTTOM_CHAMFER));

    const sec3 = buildTaperedRoundedRectGeometry(
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        FOOT_TOP_OUTER, FOOT_TOP_OUTER, FOOT_TOP_RADIUS,
        BASE_TOP_CHAMFER
    );
    sec3.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_BOTTOM_CHAMFER + BASE_VERTICAL));

    // Bottom cap at Z=0, normals face -Z (flip winding of ShapeGeometry default)
    const botCapGeo = new THREE.ShapeGeometry(roundedRectShape(FOOT_BOT_OUTER, FOOT_BOT_OUTER, FOOT_BOT_RADIUS));
    const botIdx = botCapGeo.index.array;
    for (let i = 0; i < botIdx.length; i += 3) {
        const tmp = botIdx[i + 1];
        botIdx[i + 1] = botIdx[i + 2];
        botIdx[i + 2] = tmp;
    }
    botCapGeo.computeVertexNormals();

    // Top cap at Z=BASE_HEIGHT, normals face +Z
    const topCapGeo = new THREE.ShapeGeometry(roundedRectShape(FOOT_TOP_OUTER, FOOT_TOP_OUTER, FOOT_TOP_RADIUS));
    topCapGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT));

    return mergeGeometries([sec1, sec2, sec3, botCapGeo, topCapGeo]);
}

/**
 * Builds a grid of gridfinity base feet for a multi-unit bin.
 * One foot (41.5×41.5mm) per gridfinity unit cell, centered on the 42mm grid pitch.
 */
export function buildBaseFootsGeometry(outerL, outerW) {
    const unitsX = Math.round((outerW + 0.5) / GRIDFINITY_UNIT);
    const unitsY = Math.round((outerL + 0.5) / GRIDFINITY_UNIT);
    const singleFoot = buildSingleBaseFootGeometry();
    const geos = [];
    for (let i = 0; i < unitsX; i++) {
        for (let j = 0; j < unitsY; j++) {
            const cx = (-unitsX / 2 + 0.5 + i) * GRIDFINITY_UNIT;
            const cy = (-unitsY / 2 + 0.5 + j) * GRIDFINITY_UNIT;
            const footClone = singleFoot.clone();
            footClone.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, cy, 0));
            geos.push(footClone);
        }
    }
    // Convert to non-indexed to match ExtrudeGeometry (floor/walls) which is also non-indexed.
    // mergeGeometries requires all inputs to have the same index status.
    const merged = mergeGeometries(geos);
    return merged ? merged.toNonIndexed() : null;
}

/**
 * Builds the stacking lip ring (Gridfinity spec).
 * Outer inset 0.25mm, ring width 2.15mm per side, height 4.4mm.
 */
export function buildStackingLipGeometry(outerL, outerW, cornerRadius) {
    const lipOuterL = outerL - LIP_OUTER_CLEARANCE * 2;
    const lipOuterW = outerW - LIP_OUTER_CLEARANCE * 2;
    const lipInnerL = outerL - (LIP_OUTER_CLEARANCE + LIP_WIDTH) * 2;
    const lipInnerW = outerW - (LIP_OUTER_CLEARANCE + LIP_WIDTH) * 2;
    const lipOuterR = Math.max(0, cornerRadius - LIP_OUTER_CLEARANCE);
    const lipInnerR = Math.max(0, cornerRadius - LIP_OUTER_CLEARANCE - LIP_WIDTH);
    const shape = roundedRectShape(lipOuterL, lipOuterW, lipOuterR);
    shape.holes = [roundedRectPath(lipInnerL, lipInnerW, lipInnerR)];
    return new THREE.ExtrudeGeometry(shape, { depth: LIP_HEIGHT, curveSegments: 32, bevelEnabled: false });
}

/**
 * Builds the complete bin geometry from binConfig and inlayConfig.
 * Returns a merged THREE.BufferGeometry ready for export or preview.
 */
export function buildBinGeometry(binConfig, inlayConfig) {
    const { wallThickness, floorThickness, heightMm, stackingLip, baseFeet } = binConfig;
    const innerL = inlayConfig.length;
    const innerW = inlayConfig.width;
    const innerCornerRadius = inlayConfig.cornerRadius;
    const outerL = innerL + 2 * wallThickness;
    const outerW = innerW + 2 * wallThickness;
    const outerCornerRadius = innerCornerRadius + wallThickness;

    // Wall height accounts for base foot, floor, and optional stacking lip
    const wallHeight = heightMm - BASE_HEIGHT - floorThickness - (stackingLip ? LIP_HEIGHT : 0);

    // Floor sits on top of the base foot zone
    const floorGeo = buildFloorGeometry(outerL, outerW, outerCornerRadius, floorThickness);
    floorGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT));

    // Walls start above the floor
    const wallsGeo = buildWallsGeometry(outerL, outerW, innerL, innerW, outerCornerRadius, innerCornerRadius, wallHeight);
    wallsGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT + floorThickness));

    const geometries = [floorGeo, wallsGeo];

    if (baseFeet) {
        const feetGeo = buildBaseFootsGeometry(outerL, outerW);
        geometries.push(feetGeo);
    }

    if (stackingLip) {
        const lipGeo = buildStackingLipGeometry(outerL, outerW, outerCornerRadius);
        lipGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT + floorThickness + wallHeight));
        geometries.push(lipGeo);
    }

    return mergeGeometries(geometries);
}
