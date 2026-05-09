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
import { AudioSource } from "./components/audio/AudioSource";
import { AudioProvider } from "./contexts/AudioContext";
import { useConversationContext } from "./hooks/useConversationContext";
import { Suspense, useEffect, useRef } from "react";

function SceneContent() {
  useSignals();

  const { startSession } = useConversationContext();
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (sceneStore.odysseyStarted && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      startSession();
    }
  });

  if (sceneStore.odysseyStarted) {
    return (
      <>
        <EnvironmentLoader environments={ethanEnvironments} />
        <EthanCharacter position={[0, 1, -2]} scale={0.2} />
        <Dome position={[0, 0, 0]} scale={1} />
      </>
    );
  }

  return <StartScene />;
}

function App() {
  const store = createXRStore({
    foveation: 1,
    frameRate: "high",
    frameBufferScaling: 0.85,
    meshDetection: false,
    planeDetection: false,
  });

  return (
    <ConversationProvider>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
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
          <AudioProvider>
            <AudioSource url="/audio/ambiance.wav" volume={0.05} loop />
            <Suspense fallback={null}>
              <SceneContent />
            </Suspense>
          </AudioProvider>

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
