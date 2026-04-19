import { type ThreeElements, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import {
  DoubleSide,
  type Group,
  type Mesh,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { SpatialAudioSource } from "@/components/audio/SpatialAudioSource";
import { useConversationContext } from "@/hooks/useConversationContext";
import { Eyeball } from "@/components/Eyeball";
import { ButterflyWing } from "@/components/characters/components/ButterflyWing";
import { useSignal } from "@preact/signals-react";

const BASE_FLAP_SPEED = 15.0;

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const { agentMediaStream } = useConversationContext();

  const groupRef = useRef<Group>(null);
  const flapSpeed = useSignal(BASE_FLAP_SPEED);

  // Make the flap speed pulse over time for a more dynamic look.
  useFrame(({ clock }) => {
    flapSpeed.value =
      BASE_FLAP_SPEED + 2 * Math.sin(clock.getElapsedTime() * 2);
  });

  return (
    <group ref={groupRef} {...props}>
      <Float floatIntensity={2} rotationIntensity={2} speed={4}>
        <CharacterEye scale={0.5} />
        <ButterflyWing
          rotation={[Math.PI / 4, 0, 0]}
          position={[0, 0.4, -0.2]}
          scale={3}
          flapSpeed={flapSpeed}
        />
        <SpatialAudioSource mediaStream={agentMediaStream} />
      </Float>
    </group>
  );
}

const eyeSocketMaterial = new MeshStandardMaterial({
  color: "black",
  side: DoubleSide,
  roughness: 1.0,
});

// These create the opening in the eye socket.
const SOCKET_PHI_START = (1.15 * Math.PI) / 2;
const SOCKET_PHI_LENGTH = (3.4 * Math.PI) / 2;
const BOTTOM_LID_PHI_START = SOCKET_PHI_START;
const BOTTOM_LID_PHI_LENGTH = Math.PI / 16;
const TOP_LID_PHI_LENGTH =
  2 * Math.PI - SOCKET_PHI_LENGTH - BOTTOM_LID_PHI_LENGTH;
const TOP_LID_PHI_START =
  SOCKET_PHI_START + SOCKET_PHI_LENGTH - TOP_LID_PHI_LENGTH;

// Reusable vectors to avoid per-frame allocations
const _eyeWorld = new Vector3();
const _camWorld = new Vector3();
const _localTarget = new Vector3();
const _localPos = new Vector3();

// Eye tracking bounds (radians) — adjust to taste
const EYE_YAW_MIN = -0.6;
const EYE_YAW_MAX = 0.6;
const EYE_PITCH_MIN = -0;
const EYE_PITCH_MAX = 0.3;
const EYE_SMOOTH_SPEED = 20;

// Blink timing
const BLINK_DURATION = 0.2; // seconds for a full blink (close + open)
const BLINK_INTERVAL = 3.0; // seconds between blinks

/**
 * CharacterEye is a custom eye component that includes a black sphere for the eye socket.
 * The eyeball will track the camera within defined yaw/pitch limits to create a more lifelike character.
 */
function CharacterEye(props: ThreeElements["group"]) {
  const eyeballRef = useRef<Group>(null);
  const topLidRef = useRef<Mesh>(null);
  const bottomLidRef = useRef<Mesh>(null);
  const blinkTimeRef = useRef(0);

  useFrame(({ camera }, delta) => {
    if (!eyeballRef.current?.parent) return;
    const parent = eyeballRef.current.parent;

    eyeballRef.current.getWorldPosition(_eyeWorld);
    camera.getWorldPosition(_camWorld);

    // Direction from eye to camera in the eyeball's parent local space
    parent.worldToLocal(_localTarget.copy(_camWorld));
    parent.worldToLocal(_localPos.copy(_eyeWorld));
    _localTarget.sub(_localPos).normalize();

    const yaw = Math.atan2(_localTarget.x, _localTarget.z);
    const pitch = Math.asin(MathUtils.clamp(_localTarget.y, -1, 1));

    const clampedYaw = MathUtils.clamp(yaw, EYE_YAW_MIN, EYE_YAW_MAX);
    const clampedPitch = MathUtils.clamp(pitch, EYE_PITCH_MIN, EYE_PITCH_MAX);

    const t = 1 - Math.exp(-EYE_SMOOTH_SPEED * delta);
    eyeballRef.current.rotation.y = MathUtils.lerp(
      eyeballRef.current.rotation.y,
      clampedYaw,
      t,
    );
    eyeballRef.current.rotation.x = MathUtils.lerp(
      eyeballRef.current.rotation.x,
      -clampedPitch,
      t,
    );

    blinkTimeRef.current += delta;
    // sin gives a smooth eased 0→1→0 arc during the blink window, 0 otherwise
    const phase = blinkTimeRef.current % (BLINK_INTERVAL + BLINK_DURATION);
    const closedAmount =
      phase < BLINK_DURATION ? Math.sin((phase / BLINK_DURATION) * Math.PI) : 0;
    if (topLidRef.current)
      topLidRef.current.rotation.x = closedAmount * TOP_LID_PHI_LENGTH;
    if (bottomLidRef.current)
      bottomLidRef.current.rotation.x = -closedAmount * BOTTOM_LID_PHI_LENGTH;
  });

  return (
    <group {...props}>
      {/* Eye Socket */}
      <mesh rotation={[0, 0, -Math.PI / 2]} material={eyeSocketMaterial}>
        <sphereGeometry
          args={[1.05, 16, 16, SOCKET_PHI_START, SOCKET_PHI_LENGTH]}
        />
      </mesh>
      {/* Top Eyelid */}
      <mesh
        ref={topLidRef}
        rotation={[0, 0, -Math.PI / 2]}
        material={eyeSocketMaterial}
      >
        <sphereGeometry
          args={[1.05, 16, 16, TOP_LID_PHI_START, TOP_LID_PHI_LENGTH]}
        />
      </mesh>
      {/* Bottom Eyelid */}
      <mesh
        ref={bottomLidRef}
        rotation={[0, 0, -Math.PI / 2]}
        material={eyeSocketMaterial}
      >
        <sphereGeometry
          args={[1.05, 16, 16, BOTTOM_LID_PHI_START, BOTTOM_LID_PHI_LENGTH]}
        />
      </mesh>
      <Eyeball ref={eyeballRef} />
    </group>
  );
}
