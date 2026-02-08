import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  type Euler,
  type Vector3,
  Group,
  Vector3 as Vec3,
  MathUtils,
} from "three";
import { Eyeball } from "../Eyeball";

interface FaceEyeGroupProps {
  position: Vector3;
  rotation: Euler;
  eyeScale?: number;
  /** Maximum angle (in radians) the eye can rotate to look at camera. Defaults to ~30 degrees. */
  maxLookAngle?: number;
}

// Reusable vectors to avoid allocations in the render loop
const _worldPos = new Vec3();
const _camPos = new Vec3();
const _localDir = new Vec3();

/**
 * A group that positions and rotates an eyeball on a face.
 * The group's rotation aligns with the face normal, so eye animations
 * will be relative to the face surface.
 * The eye will track the camera position, constrained by maxLookAngle.
 *
 * @param position The position of the face center.
 * @param rotation The rotation to orient the eye outward from the face.
 * @param eyeScale The scale of the eyeball. Defaults to 0.15.
 * @param maxLookAngle Maximum look angle in radians. Defaults to π/3 (~60 degrees).
 */
export function FaceEyeGroup({
  position,
  rotation,
  eyeScale = 0.15,
  maxLookAngle = Math.PI / 3, // ~60 degrees
}: FaceEyeGroupProps) {
  const outerGroupRef = useRef<Group>(null);
  const innerGroupRef = useRef<Group>(null);

  useFrame(({ camera }) => {
    if (!outerGroupRef.current || !innerGroupRef.current) return;

    // Get world position of the eye.
    outerGroupRef.current.getWorldPosition(_worldPos);

    // Get camera position.
    _camPos.copy(camera.position);

    // Direction from eye to camera in world space.
    const worldDir = _camPos.sub(_worldPos).normalize();

    // Transform direction into the outer group's local space
    // We need the inverse of the outer group's world quaternion.
    const invQuaternion = outerGroupRef.current
      .getWorldQuaternion(outerGroupRef.current.quaternion.clone())
      .invert();
    _localDir.copy(worldDir).applyQuaternion(invQuaternion);

    // Calculate pitch (rotation around X) and yaw (rotation around Y)
    // In local space, the eye looks along +Z by default.
    const yaw = Math.atan2(_localDir.x, _localDir.z);
    const pitch = -Math.atan2(
      _localDir.y,
      Math.sqrt(_localDir.x ** 2 + _localDir.z ** 2),
    );

    // Clamp angles to maxLookAngle.
    const clampedYaw = MathUtils.clamp(yaw, -maxLookAngle, maxLookAngle);
    const clampedPitch = MathUtils.clamp(pitch, -maxLookAngle, maxLookAngle);

    // Apply rotation to inner group.
    innerGroupRef.current.rotation.set(clampedPitch, clampedYaw, 0);
  });

  return (
    <group
      ref={outerGroupRef}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, rotation.order]}
    >
      {/* Inner group for eye-relative animations and camera tracking. */}
      <group ref={innerGroupRef}>
        {/*
          The eyeball model looks along -Y by default (pupil facing down).
          We rotate it 90° around X to make it look along +Z,
          then the parent group's rotation orients it to face outward from the face.
        */}
        <Eyeball
          scale={eyeScale}
          position={[0, 0, -1 * eyeScale]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </group>
  );
}
