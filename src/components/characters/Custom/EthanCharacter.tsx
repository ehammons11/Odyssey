import { type ThreeElements, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import { DoubleSide, type Group, MathUtils, Vector3 } from "three";
import { SpatialAudioSource } from "@/components/audio/SpatialAudioSource";
import { useConversationContext } from "@/hooks/useConversationContext";
import { Eyeball } from "@/components/Eyeball";

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const { agentMediaStream } = useConversationContext();

  const groupRef = useRef<Group>(null);

  return (
    <group ref={groupRef} {...props}>
      <Float floatIntensity={2} rotationIntensity={2}>
        <CharacterEye />
        <SpatialAudioSource mediaStream={agentMediaStream} />
      </Float>
    </group>
  );
}

// These create the opening in the eye socket.
const SOCKET_PHI_START = (1.15 * Math.PI) / 2;
const SOCKET_PHI_LENGTH = (3.4 * Math.PI) / 2;

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

/**
 * CharacterEye is a custom eye component that includes a black sphere for the eye socket.
 * The eyeball will track the camera within defined yaw/pitch limits to create a more lifelike character.
 */
function CharacterEye(props: ThreeElements["group"]) {
  const eyeballRef = useRef<Group>(null);

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
  });

  return (
    <group {...props}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry
          args={[1.05, 32, 32, SOCKET_PHI_START, SOCKET_PHI_LENGTH]}
        />
        <meshStandardMaterial color="black" side={DoubleSide} />
      </mesh>
      <Eyeball ref={eyeballRef} />
    </group>
  );
}
