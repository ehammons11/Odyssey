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
import { animationStore } from "@/stores/animationStore";

const BASE_FLAP_SPEED = 15.0;

// Zigzag flight path amplitude and frequency constants.
const ZIGZAG_X_AMPLITUDE = 0.3;
const ZIGZAG_Z_AMPLITUDE = 0.2;
const ZIGZAG_Y_AMPLITUDE = 0.15;
const ZIGZAG_X_FREQUENCY = 3.7;
const ZIGZAG_Z_FREQUENCY = 2.3;
const ZIGZAG_Y_FREQUENCY = 4.1;

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const { agentMediaStream } = useConversationContext();

  const groupRef = useRef<Group>(null);
  const zigzagRef = useRef<Group>(null);
  const flapSpeed = useSignal(BASE_FLAP_SPEED);

  // Internal lerped values for smooth transitions.
  const currentFlapSpeed = useRef(animationStore.flapSpeed);
  const currentZigzag = useRef(animationStore.flightZigzag);

  useFrame(({ clock }, delta) => {
    const t = 1 - Math.exp(-animationStore.lerpSpeed * delta);

    // Lerp flapSpeed toward store target, then add pulse modulation.
    currentFlapSpeed.current = MathUtils.lerp(
      currentFlapSpeed.current,
      animationStore.flapSpeed,
      t,
    );
    flapSpeed.value =
      currentFlapSpeed.current + 2 * Math.sin(clock.getElapsedTime() * 2);

    // Lerp zigzag intensity.
    currentZigzag.current = MathUtils.lerp(
      currentZigzag.current,
      animationStore.flightZigzag,
      t,
    );

    // Apply zigzag offsets to a wrapper group.
    if (zigzagRef.current) {
      const elapsed = clock.getElapsedTime();
      const z = currentZigzag.current;
      zigzagRef.current.position.x =
        z * ZIGZAG_X_AMPLITUDE * Math.sin(elapsed * ZIGZAG_X_FREQUENCY);
      zigzagRef.current.position.z =
        z * ZIGZAG_Z_AMPLITUDE * Math.sin(elapsed * ZIGZAG_Z_FREQUENCY);
      zigzagRef.current.position.y =
        z * ZIGZAG_Y_AMPLITUDE * Math.sin(elapsed * ZIGZAG_Y_FREQUENCY);
    }
  });

  return (
    <group ref={groupRef} {...props}>
      <group ref={zigzagRef}>
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

/**
 * CharacterEye is a custom eye component that includes a black sphere for the eye socket.
 * The eyeball will track the camera within defined yaw/pitch limits to create a more lifelike character.
 *
 * Reads blinkRate, eyeFrantic, and eyeOpenness from the animation store
 * and lerps toward them for smooth emotion transitions.
 */
function CharacterEye(props: ThreeElements["group"]) {
  const eyeballRef = useRef<Group>(null);
  const topLidRef = useRef<Mesh>(null);
  const bottomLidRef = useRef<Mesh>(null);
  // Blink state machine: tracks cooldown until next blink and progress through
  // the current blink. This avoids the modulo-with-changing-period bug that
  // caused flickers when blinkRate was being lerped.
  const blinkCooldown = useRef(animationStore.blinkRate);
  const blinkProgress = useRef(-1); // -1 = not blinking, 0..BLINK_DURATION = in blink

  // Lerped animation values.
  const currentBlinkRate = useRef(animationStore.blinkRate);
  const currentEyeFrantic = useRef(animationStore.eyeFrantic);
  const currentEyeOpenness = useRef(animationStore.eyeOpenness);

  // Frantic jitter targets and timing.
  const jitterYaw = useRef(0);
  const jitterPitch = useRef(0);
  const jitterTimer = useRef(0);

  useFrame(({ camera }, delta) => {
    if (!eyeballRef.current?.parent) return;
    const parent = eyeballRef.current.parent;

    const t = 1 - Math.exp(-animationStore.lerpSpeed * delta);

    // Lerp eye params toward store targets.
    currentBlinkRate.current = MathUtils.lerp(
      currentBlinkRate.current,
      animationStore.blinkRate,
      t,
    );
    currentEyeFrantic.current = MathUtils.lerp(
      currentEyeFrantic.current,
      animationStore.eyeFrantic,
      t,
    );
    currentEyeOpenness.current = MathUtils.lerp(
      currentEyeOpenness.current,
      animationStore.eyeOpenness,
      t,
    );

    // Update frantic jitter targets periodically.
    jitterTimer.current -= delta;
    if (jitterTimer.current <= 0) {
      const frantic = currentEyeFrantic.current;
      jitterYaw.current = (Math.random() - 0.5) * 2 * frantic * 0.6;
      jitterPitch.current = (Math.random() - 0.5) * 2 * frantic * 0.3;
      // More frantic = more frequent jitter changes.
      jitterTimer.current = MathUtils.lerp(0.3, 0.05, frantic);
    }

    eyeballRef.current.getWorldPosition(_eyeWorld);
    camera.getWorldPosition(_camWorld);

    // Direction from eye to camera in the eyeball's parent local space.
    parent.worldToLocal(_localTarget.copy(_camWorld));
    parent.worldToLocal(_localPos.copy(_eyeWorld));
    _localTarget.sub(_localPos).normalize();

    const yaw = Math.atan2(_localTarget.x, _localTarget.z);
    const pitch = Math.asin(MathUtils.clamp(_localTarget.y, -1, 1));

    const clampedYaw = MathUtils.clamp(
      yaw + jitterYaw.current,
      EYE_YAW_MIN,
      EYE_YAW_MAX,
    );
    const clampedPitch = MathUtils.clamp(
      pitch + jitterPitch.current,
      EYE_PITCH_MIN,
      EYE_PITCH_MAX,
    );

    const eyeT = 1 - Math.exp(-EYE_SMOOTH_SPEED * delta);
    eyeballRef.current.rotation.y = MathUtils.lerp(
      eyeballRef.current.rotation.y,
      clampedYaw,
      eyeT,
    );
    eyeballRef.current.rotation.x = MathUtils.lerp(
      eyeballRef.current.rotation.x,
      -clampedPitch,
      eyeT,
    );

    // Blink state machine.
    let blinkClosed = 0;
    if (blinkProgress.current >= 0) {
      // Currently in a blink — advance and compute closure.
      blinkProgress.current += delta;
      if (blinkProgress.current >= BLINK_DURATION) {
        // Blink finished — start cooldown for next one.
        blinkProgress.current = -1;
        blinkCooldown.current = currentBlinkRate.current;
      } else {
        blinkClosed = Math.sin(
          (blinkProgress.current / BLINK_DURATION) * Math.PI,
        );
      }
    } else {
      // Waiting for next blink.
      blinkCooldown.current -= delta;
      if (blinkCooldown.current <= 0) {
        blinkProgress.current = 0;
      }
    }

    // Eye openness: <1 squints, >1 widens. Combine with blink.
    const baseClosure = MathUtils.clamp(
      1.0 - currentEyeOpenness.current,
      0.0,
      1.0,
    );
    const closedAmount = Math.min(1.0, baseClosure + blinkClosed);

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
