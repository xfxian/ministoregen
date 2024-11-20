import { Grid, CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import Inlay from './Inlay'; // Ensure correct relative path

function ModelPreview({ modelRef, modelConfig, previewConfig }) {
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
                <Inlay modelRef={modelRef} modelConfig={modelConfig} previewConfig={previewConfig} />
            </group>

            <CameraControls makeDefault />
            <axesHelper args={[100]} />
        </Canvas>
    );
}

export default ModelPreview;