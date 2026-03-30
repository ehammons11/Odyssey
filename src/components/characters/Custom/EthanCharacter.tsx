import { type ThreeElements, useFrame } from "@react-three/fiber";
import { OctahedronCharacter } from "@/components/characters/OctahedronCharacter";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import { type Group } from "three";
import { SpatialAudioSource } from "@/components/audio/SpatialAudioSource";
import { useConversationContext } from "@/hooks/useConversationContext";

const ROTATION_SPEED = 0.3;

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const { agentMediaStream } = useConversationContext();

  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Rotate the entire character group slowly around the Y-axis.
    groupRef.current.rotation.y += ROTATION_SPEED * delta;
  });

  return (
    <group ref={groupRef} {...props}>
      <Float floatIntensity={2} rotationIntensity={2}>
        <OctahedronCharacter color="#641547" />
        <SpatialAudioSource mediaStream={agentMediaStream} />
        {/* <mesh geometry={ORB_GEOMETRY} material={ORB_MATERIAL} renderOrder={2} /> */}
      </Float>
    </group>
  );
}
