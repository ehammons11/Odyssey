import { type ThreeElements, useFrame } from "@react-three/fiber";
import { OctahedronCharacter } from "@/components/characters/OctahedronCharacter";
import { Float } from "@react-three/drei";
import { useCallback, useEffect, useRef } from "react";
import { type Group } from "three";
import {
  SpatialAudioSource,
  type SpatialAudioSourceRef,
} from "@/components/audio/SpatialAudioSource";
import { useConversationContext } from "@/hooks/useConversationContext";

const ROTATION_SPEED = 0.3;

/**
 * Custom character for Ethan's Odyssey.
 */
export function EthanCharacter(props: ThreeElements["group"]) {
  const { setOnAudio } = useConversationContext();

  const groupRef = useRef<Group>(null);
  const audioRef = useRef<SpatialAudioSourceRef>(null);

  const handleAudio = useCallback((base64Audio: string) => {
    audioRef.current?.enqueueAudio(base64Audio);
  }, []);

  // Connect the conversation audio to the SpatialAudioSource.
  useEffect(() => {
    setOnAudio(handleAudio);
    return () => {
      setOnAudio(null);
    };
  }, [handleAudio, setOnAudio]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Rotate the entire character group slowly around the Y-axis.
    groupRef.current.rotation.y += ROTATION_SPEED * delta;
  });

  return (
    <group ref={groupRef} {...props}>
      <Float floatIntensity={2} rotationIntensity={2}>
        <OctahedronCharacter color="#641547" />
        <SpatialAudioSource ref={audioRef} />
        {/* <mesh geometry={ORB_GEOMETRY} material={ORB_MATERIAL} renderOrder={2} /> */}
      </Float>
    </group>
  );
}
