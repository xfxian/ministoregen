import { useEffect, useMemo } from 'react';
import { buildGridfinityBin, unitsForInnerSize } from './geometry/gridfinity';
import { useManifold } from './geometry/manifoldLoader';
import { toBufferGeometry } from './geometry/toBufferGeometry';

function Bin({ binRef, binConfig, modelConfig, previewConfig }) {
    const wasm = useManifold();
    const { length, width } = modelConfig.inlay;
    const { wallThickness, floorThickness, heightMm, stackingLip, baseFeet, cornerSegments } = binConfig;

    const geometry = useMemo(() => {
        if (!wasm) return null;
        const manifold = buildGridfinityBin(wasm, {
            unitsX: unitsForInnerSize(width),
            unitsY: unitsForInnerSize(length),
            heightMm,
            wall: wallThickness,
            floor: floorThickness,
            lip: stackingLip,
            feet: baseFeet,
            segments: cornerSegments,
        });
        const result = toBufferGeometry(manifold);
        manifold.delete();
        return result;
    }, [wasm, length, width, wallThickness, floorThickness, heightMm, stackingLip, baseFeet, cornerSegments]);

    useEffect(() => () => geometry?.dispose(), [geometry]);

    if (!geometry) return null;

    return (
        <mesh ref={binRef} geometry={geometry}>
            <meshPhysicalMaterial
                wireframe={previewConfig.wireframe}
                color={previewConfig.color}
                clearcoat={0.5}
                clearcoatRoughness={0.4}
                reflectivity={0.25}
                transparent
                opacity={0.7}
            />
        </mesh>
    );
}

export default Bin;
