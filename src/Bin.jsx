import { buildBinGeometry } from './binGeometry';

function Bin({ binRef, binConfig, modelConfig, previewConfig, binZOffset }) {
    const { inlay } = modelConfig;
    const geometry = buildBinGeometry(binConfig, inlay);

    return (
        <mesh ref={binRef} position={[0, 0, binZOffset]}>
            <primitive object={geometry} attach="geometry" />
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
