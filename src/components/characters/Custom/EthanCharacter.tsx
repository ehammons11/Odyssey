import { type ThreeElements, useFrame } from "@react-three/fiber";
import { OctahedronCharacter } from "../OctahedronCharacter";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import { type Group } from "three";

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Rotate the entire character group slowly around the Y-axis.
    groupRef.current.rotation.y += 0.3 * delta;
  });

  return (
    <group ref={groupRef} {...props}>
      <Float floatIntensity={2} rotationIntensity={2}>
        <OctahedronCharacter color="#641547" />
      </Float>
    </group>
  );
}
