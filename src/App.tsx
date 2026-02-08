import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SplatScene } from "./components/SplatScene";
import { EthanCharacter } from "./components/characters/Custom/EthanCharacter";
import { UI } from "./components/UI";
import { IfInSessionMode, createXRStore, XR } from "@react-three/xr";
import { ConversationProvider } from "./contexts/ConversationContext";

function App() {
  const store = createXRStore({ foveation: 0, offerSession: false });

  return (
    <ConversationProvider>
      <Canvas
        camera={{ position: [0, 1, 0], fov: 60 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
        }}
      >
        <XR store={store}>
          <SplatScene url="/splats/dungeonLowRes.spz" />

          <EthanCharacter position={[0, 0.8, -0.3]} scale={0.2} />

          <OrbitControls />

          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={2} />

          <color attach="background" args={["#F2F0E6"]} />

          <IfInSessionMode deny={["immersive-ar", "immersive-vr"]}>
            <UI />
          </IfInSessionMode>
        </XR>
      </Canvas>
    </ConversationProvider>
  );
}

export default App;
