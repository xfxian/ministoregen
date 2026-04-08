import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    buildBinGeometry,
    buildBaseFootsGeometry,
    buildSingleBaseFootGeometry,
    buildStackingLipGeometry,
    BASE_HEIGHT,
    LIP_HEIGHT,
} from './binGeometry';

// 3u × 2u default bin dimensions (matching DEFAULT_INLAY and DEFAULT_BIN_CONFIG)
const INLAY_3x2 = { length: 121.9, width: 79.9, cornerRadius: 3.2 };
const BIN_CONFIG_BASE = {
    wallThickness: 1.8,
    floorThickness: 1.2,
    heightMm: 28,
    stackingLip: false,
    baseFeet: false,
};

// Gridfinity spec constants (mirrored here so tests catch regressions)
const FOOT_BOT_OUTER = 35.6;
const FOOT_MID_OUTER = 37.2;
const FOOT_TOP_OUTER = 41.5;
const BASE_BOTTOM_CHAMFER = 0.8;
const BASE_VERTICAL_TOP = BASE_BOTTOM_CHAMFER + 1.8; // Z=2.6
// Stacking lip profile keypoints [inset, z]:
// [0,0], [0.7,0.7], [0.7,2.5], [2.6,4.4]
const LIP_INSET_07 = 0.7;
const LIP_INSET_26 = 2.6;
const LIP_Z_07 = 0.7;
const LIP_Z_25 = 2.5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns [minZ, maxZ] over all vertices in a BufferGeometry.
 */
function zRange(geo) {
    expect(geo).not.toBeNull();
    const pos = geo.getAttribute('position');
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }
    return [minZ, maxZ];
}

/**
 * Returns {minX, maxX, minY, maxY} of all vertices with Z within eps of targetZ.
 * Returns null if no vertices found at that Z.
 */
function xyExtentsAtZ(geo, targetZ, eps = 0.05) {
    const pos = geo.getAttribute('position');
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let found = false;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (Math.abs(z - targetZ) <= eps) {
            const x = pos.getX(i), y = pos.getY(i);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
        }
    }
    return found ? { minX, maxX, minY, maxY } : null;
}

/**
 * For a non-indexed geometry, iterates all triangles and calls predicate(normal, centroid, a, b, c).
 * Returns count of triangles where predicate returns false.
 */
function countBadTriangles(geo, predicate) {
    const pos = geo.getAttribute('position');
    let bad = 0;
    const triCount = pos.count / 3;
    for (let t = 0; t < triCount; t++) {
        const i = t * 3;
        const a = new THREE.Vector3(pos.getX(i),   pos.getY(i),   pos.getZ(i));
        const b = new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1));
        const c = new THREE.Vector3(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2));
        const n = new THREE.Vector3()
            .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
            .normalize();
        const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1/3);
        if (!predicate(n, centroid, a, b, c)) bad++;
    }
    return bad;
}

// ─── BASE_HEIGHT constant ─────────────────────────────────────────────────────

describe('BASE_HEIGHT', () => {
    it('equals 4.75mm (0.8 + 1.8 + 2.15)', () => {
        expect(BASE_HEIGHT).toBeCloseTo(4.75, 5);
    });
});

// ─── buildSingleBaseFootGeometry — cross-section accuracy ─────────────────────

describe('buildSingleBaseFootGeometry — cross-section dims', () => {
    it('at Z=0, XY extents ≈ FOOT_BOT_OUTER (35.6mm)', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const ext = xyExtentsAtZ(geo, 0);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(FOOT_BOT_OUTER / 2, 0);
        expect(ext.maxY).toBeCloseTo(FOOT_BOT_OUTER / 2, 0);
    });

    it('at Z=0.8 (bottom chamfer top), XY extents ≈ FOOT_MID_OUTER (37.2mm)', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const ext = xyExtentsAtZ(geo, BASE_BOTTOM_CHAMFER);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(FOOT_MID_OUTER / 2, 0);
    });

    it('at Z=2.6 (vertical section top), XY extents still ≈ FOOT_MID_OUTER (37.2mm)', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const ext = xyExtentsAtZ(geo, BASE_VERTICAL_TOP);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(FOOT_MID_OUTER / 2, 0);
    });

    it('at Z=BASE_HEIGHT (4.75mm), XY extents ≈ FOOT_TOP_OUTER (41.5mm)', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const ext = xyExtentsAtZ(geo, BASE_HEIGHT);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(FOOT_TOP_OUTER / 2, 0);
    });

    it('no filled top cap — no triangles with all 3 verts at Z=BASE_HEIGHT', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const pos = geo.getAttribute('position');
        let filledCap = 0;
        for (let t = 0; t < pos.count / 3; t++) {
            const i = t * 3;
            const allAtTop = [0, 1, 2].every(
                j => Math.abs(pos.getZ(i + j) - BASE_HEIGHT) < 0.01
            );
            if (allAtTop) filledCap++;
        }
        expect(filledCap).toBe(0);
    });

    it('bottom cap normals point −Z (n.z < −0.9)', () => {
        const geo = buildSingleBaseFootGeometry().toNonIndexed();
        const bad = countBadTriangles(geo, (n, centroid) => {
            // Only check triangles at Z≈0 (bottom cap)
            if (Math.abs(centroid.z) > 0.05) return true; // skip non-cap
            return n.z < -0.9;
        });
        expect(bad).toBe(0);
    });
});

// ─── buildBaseFootsGeometry ───────────────────────────────────────────────────

describe('buildBaseFootsGeometry', () => {
    it('returns non-null geometry for a 2×3 unit bin', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness;
        const outerW = INLAY_3x2.width  + 2 * BIN_CONFIG_BASE.wallThickness;
        const geo = buildBaseFootsGeometry(outerL, outerW);
        expect(geo).not.toBeNull();
    });

    it('has vertices starting at Z=0 (feet base)', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness;
        const outerW = INLAY_3x2.width  + 2 * BIN_CONFIG_BASE.wallThickness;
        const [minZ] = zRange(buildBaseFootsGeometry(outerL, outerW));
        expect(minZ).toBeCloseTo(0, 1);
    });

    it('has vertices reaching Z=BASE_HEIGHT (feet top)', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness;
        const outerW = INLAY_3x2.width  + 2 * BIN_CONFIG_BASE.wallThickness;
        const [, maxZ] = zRange(buildBaseFootsGeometry(outerL, outerW));
        expect(maxZ).toBeCloseTo(BASE_HEIGHT, 1);
    });

    it('calculates correct unit counts for 2u×3u bin', () => {
        const GRIDFINITY_UNIT = 42;
        const outerL = 125.5, outerW = 83.5;
        expect(Math.round((outerW + 0.5) / GRIDFINITY_UNIT)).toBe(2);
        expect(Math.round((outerL + 0.5) / GRIDFINITY_UNIT)).toBe(3);
    });

    it('all side face normals point outward', () => {
        const geo = buildBaseFootsGeometry(41.5, 41.5);
        expect(geo).not.toBeNull();
        const bad = countBadTriangles(geo, (n, centroid) => {
            if (Math.abs(n.z) > 0.9) return true; // skip cap faces
            const outward = new THREE.Vector3(centroid.x, centroid.y, 0).normalize();
            return n.dot(outward) >= 0;
        });
        expect(bad).toBe(0);
    });
});

// ─── buildStackingLipGeometry — profile accuracy ──────────────────────────────

describe('buildStackingLipGeometry — profile accuracy', () => {
    // Use a 1u bin outer for simple expected dimensions
    const outerL = 41.5, outerW = 41.5, cornerR = 3.75;
    const LIP_OUTER_CLEARANCE = 0.25;
    const lipOL = outerL - LIP_OUTER_CLEARANCE * 2; // 41.0

    it('at Z≈0, outer XY extents match lip outer dims (41.0mm)', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR);
        const ni = geo.toNonIndexed();
        const ext = xyExtentsAtZ(ni, 0);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(lipOL / 2, 0);
    });

    it('outer XY extents are the same at Z=0 and Z=LIP_HEIGHT (vertical outer face)', () => {
        // The outer face has vertices only at Z=0 and Z=LIP_HEIGHT (lofted surface, no intermediate verts)
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const ext0   = xyExtentsAtZ(geo, 0);
        const extTop = xyExtentsAtZ(geo, LIP_HEIGHT);
        expect(ext0).not.toBeNull();
        expect(extTop).not.toBeNull();
        expect(extTop.maxX).toBeCloseTo(ext0.maxX, 0);
    });

    it('at Z≈0.7, vertices are at inner edge (inset 0.7mm from outer)', () => {
        // At Z=0.7, only innerA's TOP vertices exist (outer face has no vertex at this Z).
        // innerA top = inset 0.7mm → maxX ≈ lipOL/2 - 0.7
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const ext = xyExtentsAtZ(geo, LIP_Z_07);
        expect(ext).not.toBeNull();
        expect(ext.maxX).toBeCloseTo(lipOL / 2 - LIP_INSET_07, 0); // ≈ 19.8
    });

    it('at Z≈2.5, inner XY is still inset 0.7mm (vertical section)', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const ext07 = xyExtentsAtZ(geo, LIP_Z_07);
        const ext25 = xyExtentsAtZ(geo, LIP_Z_25);
        expect(ext07).not.toBeNull();
        expect(ext25).not.toBeNull();
        // Inner extents at 0.7 and 2.5 should be the same (both at inset=0.7)
        expect(ext25.minX).toBeCloseTo(ext07.minX, 0);
    });

    it('at Z=LIP_HEIGHT (4.4mm), inner edge is inset 2.6mm from outer', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const ext = xyExtentsAtZ(geo, LIP_HEIGHT);
        expect(ext).not.toBeNull();
        // Top cap inner edge: lipOL/2 - 2.6
        const expectedInnerHalf = lipOL / 2 - LIP_INSET_26;
        expect(ext.maxX).toBeCloseTo(lipOL / 2, 0);          // outer still present
        expect(ext.minX).toBeLessThan(-(expectedInnerHalf - 0.5)); // inner edge present
    });

    it('total height is LIP_HEIGHT (4.4mm)', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR);
        const [minZ, maxZ] = zRange(geo);
        expect(minZ).toBeCloseTo(0, 1);
        expect(maxZ).toBeCloseTo(LIP_HEIGHT, 1);
    });
});

// ─── buildStackingLipGeometry — normals ───────────────────────────────────────

describe('buildStackingLipGeometry — normals', () => {
    const outerL = 41.5, outerW = 41.5, cornerR = 3.75;
    const LIP_OUTER_CLEARANCE = 0.25;
    const lipOHalfL = (outerL - LIP_OUTER_CLEARANCE * 2) / 2;

    it('outer face normals point radially outward', () => {
        // Outer face is the only section that spans the FULL height (Z=0 to Z=LIP_HEIGHT).
        // Isolate it by checking that the triangle has one vertex at Z≈0 AND one at Z≈LIP_HEIGHT.
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const bad = countBadTriangles(geo, (n, centroid, a, b, c) => {
            const verts = [a, b, c];
            const hasZ0  = verts.some(v => Math.abs(v.z) < 0.05);
            const hasZtop = verts.some(v => Math.abs(v.z - LIP_HEIGHT) < 0.05);
            if (!hasZ0 || !hasZtop) return true; // skip non-outer-face triangles
            const outward = new THREE.Vector3(centroid.x, centroid.y, 0).normalize();
            return n.dot(outward) > 0;
        });
        expect(bad).toBe(0);
    });

    it('inner face normals point radially inward', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const bad = countBadTriangles(geo, (n, centroid) => {
            // Inner face: centroid XY radius clearly smaller than outer, not at top cap Z
            const r = Math.sqrt(centroid.x ** 2 + centroid.y ** 2);
            if (r > lipOHalfL * 0.92) return true; // skip outer face
            if (Math.abs(n.z) > 0.5) return true;  // skip top cap
            if (centroid.z < 0.05) return true;     // skip any bottom edge
            // Inward means n dot radial < 0
            const outward = new THREE.Vector3(centroid.x, centroid.y, 0).normalize();
            return n.dot(outward) < 0;
        });
        expect(bad).toBe(0);
    });

    it('top cap normals point +Z (n.z > 0.9)', () => {
        const geo = buildStackingLipGeometry(outerL, outerW, cornerR).toNonIndexed();
        const bad = countBadTriangles(geo, (n, centroid) => {
            if (Math.abs(centroid.z - LIP_HEIGHT) > 0.05) return true; // only top cap
            return n.z > 0.9;
        });
        expect(bad).toBe(0);
    });
});

// ─── buildBinGeometry — no feet ───────────────────────────────────────────────

describe('buildBinGeometry without base feet', () => {
    it('returns non-null geometry', () => {
        expect(buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2)).not.toBeNull();
    });

    it('minimum Z vertex is at BASE_HEIGHT (no feet → floor is lowest surface)', () => {
        const [minZ] = zRange(buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2));
        expect(minZ).toBeCloseTo(BASE_HEIGHT, 1);
    });
});

// ─── buildBinGeometry — WITH feet ─────────────────────────────────────────────

describe('buildBinGeometry with base feet enabled', () => {
    it('returns non-null geometry', () => {
        expect(buildBinGeometry({ ...BIN_CONFIG_BASE, baseFeet: true }, INLAY_3x2)).not.toBeNull();
    });

    it('minimum Z vertex is at 0 (feet base on print bed)', () => {
        const [minZ] = zRange(buildBinGeometry({ ...BIN_CONFIG_BASE, baseFeet: true }, INLAY_3x2));
        expect(minZ).toBeCloseTo(0, 1);
    });

    it('has more vertices than without feet', () => {
        const n = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2).getAttribute('position').count;
        const m = buildBinGeometry({ ...BIN_CONFIG_BASE, baseFeet: true }, INLAY_3x2).getAttribute('position').count;
        expect(m).toBeGreaterThan(n);
    });

    it('has vertices covering the foot Z range (0 to BASE_HEIGHT)', () => {
        const geo = buildBinGeometry({ ...BIN_CONFIG_BASE, baseFeet: true }, INLAY_3x2);
        const pos = geo.getAttribute('position');
        let below = false;
        for (let i = 0; i < pos.count; i++) {
            if (pos.getZ(i) < BASE_HEIGHT - 0.1) { below = true; break; }
        }
        expect(below).toBe(true);
    });
});

// ─── buildBinGeometry — stacking lip ──────────────────────────────────────────

describe('buildBinGeometry with stacking lip', () => {
    it('returns non-null geometry', () => {
        expect(buildBinGeometry({ ...BIN_CONFIG_BASE, stackingLip: true }, INLAY_3x2)).not.toBeNull();
    });

    it('total height (maxZ) stays at heightMm regardless of stacking lip', () => {
        const [, noLip] = zRange(buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2));
        const [, withLip] = zRange(buildBinGeometry({ ...BIN_CONFIG_BASE, stackingLip: true }, INLAY_3x2));
        expect(noLip).toBeCloseTo(BIN_CONFIG_BASE.heightMm, 1);
        expect(withLip).toBeCloseTo(BIN_CONFIG_BASE.heightMm, 1);
    });

    it('has more vertices with stacking lip', () => {
        const n = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2).getAttribute('position').count;
        const m = buildBinGeometry({ ...BIN_CONFIG_BASE, stackingLip: true }, INLAY_3x2).getAttribute('position').count;
        expect(m).toBeGreaterThan(n);
    });
});
