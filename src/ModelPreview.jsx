import { Grid, CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import Inlay from './Inlay';
import Bin from './Bin';
import { BASE_HEIGHT } from './binGeometry';

function ModelPreview({ modelRef, binRef, modelConfig, binConfig, previewConfig, selectedSection, showMiniatureCylinders }) {
    const binEnabled = binConfig.enabled;

    // Lift the model so its physical bottom rests on the grid (Z=0).
    // Bin geometry: Z=0 = feet bottom, Z=BASE_HEIGHT = floor bottom, Z=BASE_HEIGHT+floor = cavity bottom.
    // With feet: feet touch ground → binZOffset=0.
    // Without feet: floor bottom touches ground → binZOffset=-BASE_HEIGHT.
    const binZOffset = binEnabled
        ? (binConfig.baseFeet ? 0 : -BASE_HEIGHT)
        : 0;

    // Inlay sits on the bin floor (inside the cavity), or flat on ground if no bin.
    const inlayZOffset = binEnabled
        ? binZOffset + BASE_HEIGHT + binConfig.floorThickness + 0.01
        : 0;

    return (
        <Canvas shadows camera={{ position: [75, 75, 75] }}>
            <Grid
                infiniteGrid
                cellSize={10}
                sectionSize={1}
                fadeDistance={1000}
                fadeStrength={10}
                fadeFrom={0}
            />
            {/* <ambientLight intensity={1} /> */}
            <pointLight position={[-75, 150, 75]} intensity={3} decay={0.1} color={'white'} />
            <pointLight position={[75, 150, -75]} intensity={3} decay={0.1} color={'white'} />

            <group rotation={[Math.PI / 2, Math.PI, 0]}>
                {binEnabled && (
                    <Bin binRef={binRef} binConfig={binConfig} modelConfig={modelConfig} previewConfig={previewConfig} binZOffset={binZOffset} />
                )}
                <Inlay
                    modelRef={modelRef}
                    modelConfig={modelConfig}
                    previewConfig={previewConfig}
                    inlayZOffset={inlayZOffset}
                    selectedSection={selectedSection}
                    showMiniatureCylinders={showMiniatureCylinders}
                />
            </group>

            <CameraControls makeDefault />
            <axesHelper args={[100]} />
        </Canvas>
    );
}

export default ModelPreview;
