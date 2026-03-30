import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Group, PositionalAudio, AudioListener } from "three";

interface SpatialAudioSourceProps {
  mediaStream: MediaStream | null;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: "linear" | "inverse" | "exponential";
}

/**
 * A spatial audio source component that plays a MediaStream through
 * Three.js PositionalAudio for 3D-spatialized playback.
 */
export function SpatialAudioSource({
  mediaStream,
  refDistance = 1,
  rolloffFactor = 1,
  maxDistance = 50,
  distanceModel = "inverse",
}: SpatialAudioSourceProps) {
  const { camera } = useThree();
  const positionalAudioRef = useRef<PositionalAudio | null>(null);
  const listenerRef = useRef<AudioListener | null>(null);
  const groupRef = useRef<Group>(null!);

  // 1. Create AudioListener, PositionalAudio, and attach to camera.
  useEffect(() => {
    const group = groupRef.current;

    const listener = new AudioListener();
    camera.add(listener);
    listenerRef.current = listener;

    const positionalAudio = new PositionalAudio(listener);
    positionalAudio.setRefDistance(refDistance);
    positionalAudio.setRolloffFactor(rolloffFactor);
    positionalAudio.setMaxDistance(maxDistance);
    positionalAudio.setDistanceModel(distanceModel);
    group.add(positionalAudio);
    positionalAudioRef.current = positionalAudio;

    // Resume the AudioContext on the first user gesture.
    const context = listener.context;
    const resumeContext = () => {
      if (context.state === "suspended") {
        context.resume().then(() => {
          console.log("Three.js AudioContext resumed via user gesture");
        });
      }
    };

    resumeContext();

    const events = ["click", "touchstart", "keydown"] as const;
    const onGesture = () => {
      resumeContext();
      events.forEach((e) => document.removeEventListener(e, onGesture));
    };
    events.forEach((e) =>
      document.addEventListener(e, onGesture, { once: true }),
    );

    return () => {
      events.forEach((e) => document.removeEventListener(e, onGesture));
      try {
        positionalAudio.disconnect();
      } catch {
        // Node may not be connected
      }
      group.remove(positionalAudio);
      camera.remove(listener);
      positionalAudioRef.current = null;
      listenerRef.current = null;
    };
  }, [camera, refDistance, rolloffFactor, maxDistance, distanceModel]);

  // 2. When a MediaStream becomes available, hook it into the PositionalAudio.
  useEffect(() => {
    const positionalAudio = positionalAudioRef.current;
    if (!positionalAudio || !mediaStream) return;

    positionalAudio.setMediaStreamSource(mediaStream);

    return () => {
      try {
        positionalAudio.disconnect();
      } catch {
        // Node may not be connected
      }
    };
  }, [mediaStream]);

  return <group ref={groupRef} />;
}
