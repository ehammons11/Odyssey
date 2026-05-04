import { Container, Text } from "@react-three/uikit";
import { useSignal } from "@preact/signals-react";
import { useSpringValue } from "@react-spring/three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Title } from "./Title";
import { sceneStore } from "@/stores/sceneStore";
import {
  AudioSource,
  type AudioSourceHandle,
} from "@/components/audio/AudioSource";

const HOVER_OPACITY = 1;
const DEFAULT_OPACITY = 0.6;

/**
 * The title screen for the Odyssey experience. Shows the title and a start button.
 */
export function StartScene() {
  return (
    <>
      <Title position={[0, 2, -10]} scale={0.5} />
      <StartButton />
    </>
  );
}

/**
 * Button to start the Odyssey experience.
 */
function StartButton() {
  const buttonOpacity = useSignal(DEFAULT_OPACITY);
  const buttonOpacitySpring = useSpringValue(DEFAULT_OPACITY);
  const buttonSound = useRef<AudioSourceHandle>(null);

  useFrame(() => {
    buttonOpacity.value = buttonOpacitySpring.get();
  });

  return (
    <group position={[0, 0.6, -10]}>
      <AudioSource ref={buttonSound} url="/audio/button.wav" autoplay={false} />
      <Container
        backgroundColor="lightgray"
        opacity={buttonOpacity}
        width={160}
        height={50}
        justifyContent="center"
        borderRadius={10}
        borderWidth={2}
        borderColor="black"
        onHoverChange={(hover: boolean) => {
          buttonOpacitySpring.start(hover ? HOVER_OPACITY : DEFAULT_OPACITY);
        }}
        onClick={() => {
          buttonSound.current?.play();
          sceneStore.startOdyssey();
        }}
      >
        <Text textAlign="center" fontWeight="black" color="black">
          Start
        </Text>
      </Container>
    </group>
  );
}
