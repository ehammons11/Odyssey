import {
  Fullscreen,
  Container,
  Text,
  type ContainerProperties,
} from "@react-three/uikit";
import { useSpringValue } from "@react-spring/three";
import { useSignal } from "@preact/signals-react";
import { useFrame } from "@react-three/fiber";
import { useXRStore } from "@react-three/xr";
import { useConversationContext } from "../hooks/useConversationContext";
import { environmentStore } from "../stores/environmentStore";

const HOVER_OPACITY = 1;
const DEFAULT_OPACITY = 0.5;

/**
 * UI for the Odyssey on desktop.
 */
export function UI(props: ContainerProperties) {
  return (
    <Fullscreen pointerEvents="listener" renderOrder={2}>
      <Container flexDirection="column" flexGrow={3}>
        <Container
          flexGrow={3}
          alignItems="center"
          justifyContent="center"
          flexDirection="row"
          gap={10}
        >
          <PreviousEnvironmentButton />
          <StartButton {...props} />
          <EnterXRButton />
          <NextEnvironmentButton />
        </Container>
      </Container>
    </Fullscreen>
  );
}

const BUTTON_WIDTH = 100; // px.
const BUTTON_HEIGHT = 50; // px.

/**
 * Button to start the session with the Post-Human God.
 */
export function StartButton(props: ContainerProperties) {
  const { startSession, endSession, isConnected } = useConversationContext();

  const startButtonOpacity = useSignal(DEFAULT_OPACITY);
  const startButtonOpacitySpring = useSpringValue(DEFAULT_OPACITY);

  useFrame(() => {
    startButtonOpacity.value = startButtonOpacitySpring.get();
  });

  const handleClick = () => {
    if (!isConnected) {
      startSession();
    } else {
      endSession();
    }
  };

  return (
    <Container
      backgroundColor="lightgray"
      opacity={startButtonOpacity}
      width={BUTTON_WIDTH}
      height={BUTTON_HEIGHT}
      marginTop="auto"
      marginBottom={50}
      alignSelf="center"
      justifyContent="center"
      borderRadius={10}
      onHoverChange={(hover: boolean) => {
        if (hover) {
          startButtonOpacitySpring.start(HOVER_OPACITY);
        } else {
          startButtonOpacitySpring.start(DEFAULT_OPACITY);
        }
      }}
      onClick={handleClick}
      {...props}
    >
      <Text textAlign="center" fontWeight="black" color="black">
        {isConnected ? "Stop Session" : "Start Session"}
      </Text>
    </Container>
  );
}

/**
 * Button to enter XR for the Post-Human God session. Hold to record.
 */
export function EnterXRButton(props: ContainerProperties) {
  const store = useXRStore();

  const enterXRButtonOpacity = useSignal(DEFAULT_OPACITY);
  const enterXRButtonOpacitySpring = useSpringValue(DEFAULT_OPACITY);

  useFrame(() => {
    enterXRButtonOpacity.value = enterXRButtonOpacitySpring.get();
  });

  return (
    <Container
      backgroundColor="lightgray"
      opacity={enterXRButtonOpacity}
      width={BUTTON_WIDTH}
      height={BUTTON_HEIGHT}
      marginTop="auto"
      marginBottom={50}
      alignSelf="center"
      justifyContent="center"
      borderRadius={10}
      onHoverChange={(hover: boolean) => {
        if (hover) {
          enterXRButtonOpacitySpring.start(HOVER_OPACITY);
        } else {
          enterXRButtonOpacitySpring.start(DEFAULT_OPACITY);
        }
      }}
      onClick={() => store.enterVR()}
      {...props}
    >
      <Text textAlign="center" fontWeight="black" color="black">
        Enter XR
      </Text>
    </Container>
  );
}

/**
 * Button to go to the previous environment.
 */
export function PreviousEnvironmentButton(props: ContainerProperties) {
  const opacity = useSignal(DEFAULT_OPACITY);
  const opacitySpring = useSpringValue(DEFAULT_OPACITY);

  useFrame(() => {
    opacity.value = opacitySpring.get();
  });

  return (
    <Container
      backgroundColor="lightgray"
      opacity={opacity}
      width={BUTTON_WIDTH}
      height={BUTTON_HEIGHT}
      marginTop="auto"
      marginBottom={50}
      alignSelf="center"
      justifyContent="center"
      borderRadius={10}
      onHoverChange={(hover: boolean) => {
        if (hover) {
          opacitySpring.start(HOVER_OPACITY);
        } else {
          opacitySpring.start(DEFAULT_OPACITY);
        }
      }}
      onClick={() => environmentStore.previous()}
      {...props}
    >
      <Text textAlign="center" fontWeight="black" color="black">
        {"< Prev"}
      </Text>
    </Container>
  );
}

/**
 * Button to go to the next environment.
 */
export function NextEnvironmentButton(props: ContainerProperties) {
  const opacity = useSignal(DEFAULT_OPACITY);
  const opacitySpring = useSpringValue(DEFAULT_OPACITY);

  useFrame(() => {
    opacity.value = opacitySpring.get();
  });

  return (
    <Container
      backgroundColor="lightgray"
      opacity={opacity}
      width={BUTTON_WIDTH}
      height={BUTTON_HEIGHT}
      marginTop="auto"
      marginBottom={50}
      alignSelf="center"
      justifyContent="center"
      borderRadius={10}
      onHoverChange={(hover: boolean) => {
        if (hover) {
          opacitySpring.start(HOVER_OPACITY);
        } else {
          opacitySpring.start(DEFAULT_OPACITY);
        }
      }}
      onClick={() => environmentStore.next()}
      {...props}
    >
      <Text textAlign="center" fontWeight="black" color="black">
        {"Next >"}
      </Text>
    </Container>
  );
}
