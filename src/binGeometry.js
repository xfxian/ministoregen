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
// Profile: STACKING_LIP_LINE = [[0,0],[0.7,0.7],[0.7,2.5],[2.6,4.4]]
// [inset_from_outer, height] at each keypoint
const LIP_CHAMFER_BOT = 0.7;         // bottom chamfer: 0.7mm in × 0.7mm up (45°)
const LIP_VERT = 1.8;                // vertical inner section height (2.5 - 0.7)
const LIP_CHAMFER_TOP = 1.9;         // top chamfer height (4.4 - 2.5), same width (45°)
const LIP_TOTAL_DEPTH = 2.6;         // total inward extent at lip top (0.7 + 1.9)
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

export function buildFloorGeometry(outerL, outerW, cornerRadius, floorThickness, cornerSegments = 32) {
    const shape = roundedRectShape(outerL, outerW, cornerRadius);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: floorThickness, curveSegments: cornerSegments, bevelEnabled: false });
    return geo;
}

export function buildWallsGeometry(outerL, outerW, innerL, innerW, outerCornerRadius, innerCornerRadius, wallHeight, cornerSegments = 32) {
    const shape = roundedRectShape(outerL, outerW, outerCornerRadius);
    shape.holes = [roundedRectPath(innerL, innerW, innerCornerRadius)];
    const geo = new THREE.ExtrudeGeometry(shape, { depth: wallHeight, curveSegments: cornerSegments, bevelEnabled: false });
    return geo;
}

/**
 * Builds the side surface (no caps) of a lofted solid between two rounded rectangles.
 * Bottom profile at Z=0, top profile at Z=height.
 */
function buildTaperedRoundedRectGeometry(botL, botW, botR, topL, topW, topR, height, flipNormals = false, N = 256) {
    // Use getSpacedPoints(N) — always returns exactly N+1 arc-length-uniform points,
    // with points[0] == points[N] (closing the ring), regardless of three.js version.
    // (getPoints(N) in three.js r170+ gives arcs N*2 samples each, far more than N+1.)
    const botPts = roundedRectShape(botL, botW, botR).getSpacedPoints(N); // N+1 pts, [0]==[N]
    const topPts = roundedRectShape(topL, topW, topR).getSpacedPoints(N);

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
        // roundedRectShape traces CW, so winding (b0,t0,b1) = outward; flipped = inward
        if (flipNormals) {
            indices.push(b0, b1, t0);
            indices.push(b1, t1, t0);
        } else {
            indices.push(b0, t0, b1);
            indices.push(b1, t0, t1);
        }
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
 * Top cap is intentionally omitted — the bin floor covers it at Z=BASE_HEIGHT.
 */
export function buildSingleBaseFootGeometry(cornerSegments = 32) {
    const N = cornerSegments * 8;
    // Side surfaces for 3 sections
    const sec1 = buildTaperedRoundedRectGeometry(
        FOOT_BOT_OUTER, FOOT_BOT_OUTER, FOOT_BOT_RADIUS,
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        BASE_BOTTOM_CHAMFER, false, N
    );

    const sec2 = buildTaperedRoundedRectGeometry(
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        BASE_VERTICAL, false, N
    );
    sec2.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_BOTTOM_CHAMFER));

    const sec3 = buildTaperedRoundedRectGeometry(
        FOOT_MID_OUTER, FOOT_MID_OUTER, FOOT_MID_RADIUS,
        FOOT_TOP_OUTER, FOOT_TOP_OUTER, FOOT_TOP_RADIUS,
        BASE_TOP_CHAMFER, false, N
    );
    sec3.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_BOTTOM_CHAMFER + BASE_VERTICAL));

    // Bottom cap at Z=0, normals face -Z (flip winding of ShapeGeometry default)
    const botCapGeo = new THREE.ShapeGeometry(roundedRectShape(FOOT_BOT_OUTER, FOOT_BOT_OUTER, FOOT_BOT_RADIUS), cornerSegments);
    const botIdx = botCapGeo.index.array;
    for (let i = 0; i < botIdx.length; i += 3) {
        const tmp = botIdx[i + 1];
        botIdx[i + 1] = botIdx[i + 2];
        botIdx[i + 2] = tmp;
    }
    botCapGeo.computeVertexNormals();

    // No top cap — the bin floor bottom face (at Z=BASE_HEIGHT) closes the solid,
    // avoiding co-planar z-fighting between foot top and floor bottom.
    return mergeGeometries([sec1, sec2, sec3, botCapGeo]);
}

/**
 * Builds a grid of gridfinity base feet for a multi-unit bin.
 * One foot (41.5×41.5mm) per gridfinity unit cell, centered on the 42mm grid pitch.
 */
export function buildBaseFootsGeometry(outerL, outerW, cornerSegments = 32) {
    const unitsX = Math.round((outerW + 0.5) / GRIDFINITY_UNIT);
    const unitsY = Math.round((outerL + 0.5) / GRIDFINITY_UNIT);
    const singleFoot = buildSingleBaseFootGeometry(cornerSegments);
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
 * Profile: STACKING_LIP_LINE = [[0,0],[0.7,0.7],[0.7,2.5],[2.6,4.4]]
 * Outer face is vertical 4.4mm. Inner face has stepped profile.
 */
export function buildStackingLipGeometry(outerL, outerW, cornerRadius, cornerSegments = 32) {
    const N = cornerSegments * 8;
    // Inner dimensions at inset=0.7mm (bottom chamfer top / vertical inner face)
    // Base of innerA starts flush with the bin wall outer face (outerL/outerW/cornerRadius)
    const lip07L = outerL - LIP_CHAMFER_BOT * 2;
    const lip07W = outerW - LIP_CHAMFER_BOT * 2;
    const lip07R = Math.max(0, cornerRadius - LIP_CHAMFER_BOT);

    // Inner dimensions at inset=2.6mm (lip tip / top cap inner edge)
    const lip26L = outerL - LIP_TOTAL_DEPTH * 2;
    const lip26W = outerW - LIP_TOTAL_DEPTH * 2;
    const lip26R = Math.max(0, cornerRadius - LIP_TOTAL_DEPTH);

    // Inner section A: bottom chamfer Z=0→0.7, base flush with bin wall, inset 0→0.7mm 45°
    const innerA = buildTaperedRoundedRectGeometry(
        outerL, outerW, cornerRadius, lip07L, lip07W, lip07R, LIP_CHAMFER_BOT, true, N);

    // Inner section B: vertical inner wall Z=0.7→2.5, inset stays 0.7mm (inward normals)
    const innerB = buildTaperedRoundedRectGeometry(
        lip07L, lip07W, lip07R, lip07L, lip07W, lip07R, LIP_VERT, true, N);
    innerB.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, LIP_CHAMFER_BOT));

    // Inner section C: top chamfer Z=2.5→4.4, inset 0.7→2.6mm 45° (inward normals)
    const innerC = buildTaperedRoundedRectGeometry(
        lip07L, lip07W, lip07R, lip26L, lip26W, lip26R, LIP_CHAMFER_TOP, true, N);
    innerC.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, LIP_CHAMFER_BOT + LIP_VERT));

    // Outer face: vertical wall Z=0→4.4, outward-facing normals
    const outer = buildTaperedRoundedRectGeometry(
        outerL, outerW, cornerRadius,
        outerL, outerW, cornerRadius,
        LIP_HEIGHT, false, N);

    // Top ring cap at Z=4.4 (+Z normals via ShapeGeometry with hole)
    const topShape = roundedRectShape(outerL, outerW, cornerRadius);
    topShape.holes = [roundedRectPath(lip26L, lip26W, lip26R)];
    const topCap = new THREE.ShapeGeometry(topShape, cornerSegments);
    topCap.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, LIP_HEIGHT));

    return mergeGeometries([outer, innerA, innerB, innerC, topCap]);
}

/**
 * Builds the complete bin geometry from binConfig and inlayConfig.
 * Returns a merged THREE.BufferGeometry ready for export or preview.
 */
export function buildBinGeometry(binConfig, inlayConfig) {
    const { wallThickness, floorThickness, heightMm, stackingLip, baseFeet, cornerSegments = 32 } = binConfig;
    const innerL = inlayConfig.length;
    const innerW = inlayConfig.width;
    const innerCornerRadius = inlayConfig.cornerRadius;
    const outerL = innerL + 2 * wallThickness;
    const outerW = innerW + 2 * wallThickness;
    const outerCornerRadius = innerCornerRadius + wallThickness;

    // Wall height accounts for base foot, floor, and optional stacking lip
    const wallHeight = heightMm - BASE_HEIGHT - floorThickness - (stackingLip ? LIP_HEIGHT : 0);

    // Floor sits on top of the base foot zone
    const floorGeo = buildFloorGeometry(outerL, outerW, outerCornerRadius, floorThickness, cornerSegments);
    floorGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT));

    // Walls start above the floor
    const wallsGeo = buildWallsGeometry(outerL, outerW, innerL, innerW, outerCornerRadius, innerCornerRadius, wallHeight, cornerSegments);
    wallsGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT + floorThickness));

    const geometries = [floorGeo, wallsGeo];

    if (baseFeet) {
        const feetGeo = buildBaseFootsGeometry(outerL, outerW, cornerSegments);
        geometries.push(feetGeo);
    }

    if (stackingLip) {
        // toNonIndexed() because floor/walls use ExtrudeGeometry (non-indexed)
        const lipGeo = buildStackingLipGeometry(outerL, outerW, outerCornerRadius, cornerSegments).toNonIndexed();
        lipGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, BASE_HEIGHT + floorThickness + wallHeight));
        geometries.push(lipGeo);
    }

    return mergeGeometries(geometries);
}
