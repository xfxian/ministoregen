import { Grid, CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import Inlay from './Inlay';
import Bin from './Bin';
import { cavityBottom } from './geometry/gridfinity';

function ModelPreview({ modelRef, binRef, modelConfig, binConfig, previewConfig, selectedSection, showMiniatureCylinders }) {
    const binEnabled = binConfig.enabled;

    // The bin geometry rests on Z=0. The inlay sits on the cavity floor, or on the ground without a bin.
    const inlayZOffset = binEnabled
        ? cavityBottom({ feet: binConfig.baseFeet, floor: binConfig.floorThickness }) + 0.01
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
                    <Bin binRef={binRef} binConfig={binConfig} modelConfig={modelConfig} previewConfig={previewConfig} />
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
