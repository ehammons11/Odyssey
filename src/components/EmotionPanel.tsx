import { Container, Text, type ContainerProperties } from "@react-three/uikit";
import { useSpringValue } from "@react-spring/three";
import { useSignal, useSignalEffect } from "@preact/signals-react";
import { useFrame } from "@react-three/fiber";
import { animationStore, EMOTIONS } from "@/stores/animationStore";

const EMOTION_BUTTON_WIDTH = 80; // px.
const EMOTION_BUTTON_HEIGHT = 36;
const DEFAULT_OPACITY = 0.4;
const HOVER_OPACITY = 0.8;
const ACTIVE_OPACITY = 1.0;

const emotionNames = Object.keys(EMOTIONS);

/**
 * A row of buttons for switching between emotion animation presets.
 */
export function EmotionPanel(props: ContainerProperties) {
  return (
    <Container
      flexDirection="column"
      gap={6}
      flexWrap="wrap"
      justifyContent="center"
      alignItems="flex-end"
      margin={10}
      {...props}
    >
      {emotionNames.map((name) => (
        <EmotionButton key={name} emotion={name} />
      ))}
    </Container>
  );
}

interface EmotionButtonProps {
  emotion: string;
}

/**
 * Button for selecting a specific emotion preset.
 *
 * @param emotion The name of the emotion preset to activate when clicked.
 */
function EmotionButton({ emotion }: EmotionButtonProps) {
  const opacity = useSignal(DEFAULT_OPACITY);
  const opacitySpring = useSpringValue(DEFAULT_OPACITY);

  useSignalEffect(() => {
    // When the active emotion changes, if this button's emotion is now active,
    // set opacity to ACTIVE_OPACITY immediately. Otherwise, reset to default.
    opacitySpring.start(
      animationStore.activeEmotion === emotion
        ? ACTIVE_OPACITY
        : DEFAULT_OPACITY,
    );
  });

  useFrame(() => {
    opacity.value = opacitySpring.get();
  });

  return (
    <Container
      backgroundColor="lightgray"
      opacity={opacity}
      width={EMOTION_BUTTON_WIDTH}
      height={EMOTION_BUTTON_HEIGHT}
      justifyContent="center"
      borderRadius={8}
      onHoverChange={(hover: boolean) => {
        if (animationStore.activeEmotion === emotion) return;
        opacitySpring.start(hover ? HOVER_OPACITY : DEFAULT_OPACITY);
      }}
      onClick={() => animationStore.setEmotion(emotion)}
    >
      <Text textAlign="center" fontWeight="bold" color="black" fontSize={12}>
        {emotion}
      </Text>
    </Container>
  );
}
