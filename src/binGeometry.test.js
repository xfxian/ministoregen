import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    buildBinGeometry,
    buildBaseFootsGeometry,
    BASE_HEIGHT,
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

// ─── BASE_HEIGHT constant ──────────────────────────────────────────────────

describe('BASE_HEIGHT', () => {
    it('equals 4.75mm (0.8 + 1.8 + 2.15)', () => {
        expect(BASE_HEIGHT).toBeCloseTo(4.75, 5);
    });
});

// ─── buildBaseFootsGeometry ────────────────────────────────────────────────

describe('buildBaseFootsGeometry', () => {
    it('returns non-null geometry for a 2×3 unit bin', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness; // 125.5
        const outerW = INLAY_3x2.width + 2 * BIN_CONFIG_BASE.wallThickness;  // 83.5
        const geo = buildBaseFootsGeometry(outerL, outerW);
        expect(geo).not.toBeNull();
    });

    it('has vertices starting at Z=0 (feet base)', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness;
        const outerW = INLAY_3x2.width + 2 * BIN_CONFIG_BASE.wallThickness;
        const geo = buildBaseFootsGeometry(outerL, outerW);
        const [minZ] = zRange(geo);
        expect(minZ).toBeCloseTo(0, 1);
    });

    it('has vertices reaching Z=BASE_HEIGHT (feet top)', () => {
        const outerL = INLAY_3x2.length + 2 * BIN_CONFIG_BASE.wallThickness;
        const outerW = INLAY_3x2.width + 2 * BIN_CONFIG_BASE.wallThickness;
        const geo = buildBaseFootsGeometry(outerL, outerW);
        const [, maxZ] = zRange(geo);
        expect(maxZ).toBeCloseTo(BASE_HEIGHT, 1);
    });

    it('calculates correct unit counts for 2u×3u bin (2 wide, 3 long)', () => {
        // outerW=83.5 → 2 units, outerL=125.5 → 3 units → 6 feet total
        const outerL = 125.5, outerW = 83.5;
        const GRIDFINITY_UNIT = 42;
        const unitsX = Math.round((outerW + 0.5) / GRIDFINITY_UNIT);
        const unitsY = Math.round((outerL + 0.5) / GRIDFINITY_UNIT);
        expect(unitsX).toBe(2);
        expect(unitsY).toBe(3);
    });

    it('returns non-null geometry for a 1×1 unit bin', () => {
        const innerSize = 37.9; // 1u inner
        const outerSize = innerSize + 2 * 1.8; // 41.5
        const geo = buildBaseFootsGeometry(outerSize, outerSize);
        expect(geo).not.toBeNull();
        const [minZ] = zRange(geo);
        expect(minZ).toBeCloseTo(0, 1);
    });

    it('all side face normals point outward (no backface culling issues)', () => {
        // Use a single 1×1 unit foot (outerSize = 41.5mm) so the foot center is at (0,0)
        // and outward direction is simply away from the origin in XY.
        const outerSize = 41.5; // exactly 1 gridfinity unit outer
        const geo = buildBaseFootsGeometry(outerSize, outerSize);
        expect(geo).not.toBeNull();

        const pos = geo.getAttribute('position');
        let inwardCount = 0;
        const triCount = pos.count / 3;
        for (let t = 0; t < triCount; t++) {
            const i = t * 3;
            const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
            const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
            const n = new THREE.Vector3()
                .crossVectors(
                    new THREE.Vector3().subVectors(b, a),
                    new THREE.Vector3().subVectors(c, a)
                )
                .normalize();
            // Skip cap faces (near-horizontal)
            if (Math.abs(n.z) > 0.9) continue;
            // Face center — for a single centered foot, outward = away from origin in XY
            const mid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
            const outward = new THREE.Vector3(mid.x, mid.y, 0).normalize();
            if (n.dot(outward) < 0) inwardCount++;
        }
        expect(inwardCount).toBe(0);
    });
});

// ─── buildBinGeometry — no feet ────────────────────────────────────────────

describe('buildBinGeometry without base feet', () => {
    it('returns non-null geometry', () => {
        const geo = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2);
        expect(geo).not.toBeNull();
    });

    it('minimum Z vertex is at BASE_HEIGHT (no feet → floor is lowest surface)', () => {
        const geo = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2);
        const [minZ] = zRange(geo);
        // Floor bottom is at BASE_HEIGHT when no feet are present
        expect(minZ).toBeCloseTo(BASE_HEIGHT, 1);
    });
});

// ─── buildBinGeometry — WITH feet ─────────────────────────────────────────

describe('buildBinGeometry with base feet enabled', () => {
    it('returns non-null geometry', () => {
        const config = { ...BIN_CONFIG_BASE, baseFeet: true };
        const geo = buildBinGeometry(config, INLAY_3x2);
        expect(geo).not.toBeNull();
    });

    it('minimum Z vertex is at 0 (feet base on print bed)', () => {
        const config = { ...BIN_CONFIG_BASE, baseFeet: true };
        const geo = buildBinGeometry(config, INLAY_3x2);
        const [minZ] = zRange(geo);
        expect(minZ).toBeCloseTo(0, 1);
    });

    it('has more vertices than without feet (feet add geometry)', () => {
        const geoNoFeet = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2);
        const geoWithFeet = buildBinGeometry({ ...BIN_CONFIG_BASE, baseFeet: true }, INLAY_3x2);
        expect(geoWithFeet.getAttribute('position').count).toBeGreaterThan(
            geoNoFeet.getAttribute('position').count
        );
    });

    it('has vertices covering the foot Z range (0 to BASE_HEIGHT)', () => {
        const config = { ...BIN_CONFIG_BASE, baseFeet: true };
        const geo = buildBinGeometry(config, INLAY_3x2);
        const pos = geo.getAttribute('position');
        let hasVertexBelowFloor = false;
        for (let i = 0; i < pos.count; i++) {
            if (pos.getZ(i) < BASE_HEIGHT - 0.1) {
                hasVertexBelowFloor = true;
                break;
            }
        }
        expect(hasVertexBelowFloor).toBe(true);
    });
});

// ─── buildBinGeometry — stacking lip ──────────────────────────────────────

describe('buildBinGeometry with stacking lip', () => {
    it('returns non-null geometry', () => {
        const config = { ...BIN_CONFIG_BASE, stackingLip: true };
        const geo = buildBinGeometry(config, INLAY_3x2);
        expect(geo).not.toBeNull();
    });

    it('total height (maxZ) stays at heightMm regardless of stacking lip', () => {
        // The stacking lip replaces wall height, so total height = heightMm either way
        const [, maxZNoLip] = zRange(buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2));
        const [, maxZWithLip] = zRange(buildBinGeometry({ ...BIN_CONFIG_BASE, stackingLip: true }, INLAY_3x2));
        expect(maxZNoLip).toBeCloseTo(BIN_CONFIG_BASE.heightMm, 1);
        expect(maxZWithLip).toBeCloseTo(BIN_CONFIG_BASE.heightMm, 1);
    });

    it('has more vertices with stacking lip (lip adds geometry)', () => {
        const geoNoLip = buildBinGeometry(BIN_CONFIG_BASE, INLAY_3x2);
        const geoWithLip = buildBinGeometry({ ...BIN_CONFIG_BASE, stackingLip: true }, INLAY_3x2);
        expect(geoWithLip.getAttribute('position').count).toBeGreaterThan(
            geoNoLip.getAttribute('position').count
        );
    });
});
