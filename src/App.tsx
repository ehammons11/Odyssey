import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { EthanCharacter } from "./components/characters/Custom/EthanCharacter";
import { UI } from "./components/UI";
import { IfInSessionMode, createXRStore, XR } from "@react-three/xr";
import { ConversationProvider } from "./contexts/ConversationContext";
import { EnvironmentLoader } from "./components/EnvironmentLoader";
import { ethanEnvironments } from "./environments/ethan";
import { Dome } from "./components/Dome";
import { StartScene } from "./components/titleScreen/StartScene";
import { SceneFader } from "./components/SceneFader";
import { sceneStore } from "./stores/sceneStore";
import { useSignals } from "@preact/signals-react/runtime";

function SceneContent() {
  useSignals();

  if (sceneStore.odysseyStarted) {
    return (
      <>
        <EnvironmentLoader environments={ethanEnvironments} />
        <EthanCharacter position={[0, 1, -0.3]} scale={0.2} />
        <Dome position={[0, 0, 0]} scale={1} />
        {/* <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="green" />
        </mesh> */}
      </>
    );
  }

  return <StartScene />;
}

function App() {
  const store = createXRStore({ foveation: 0, offerSession: false });

  return (
    <ConversationProvider>
      <Canvas
        camera={{ position: [0, 1, 0], rotation: [0, 0, 0], fov: 60 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
        }}
      >
        <XR store={store}>
          <SceneContent />

          <Environment background files="./environmentMaps/puresky_2.exr" />

          <SceneFader />

          <OrbitControls />

          <IfInSessionMode deny={["immersive-ar", "immersive-vr"]}>
            <UI />
          </IfInSessionMode>
        </XR>
      </Canvas>
    </ConversationProvider>
  );
}

export default App;
