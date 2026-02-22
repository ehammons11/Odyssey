import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useThree } from "@react-three/fiber";
import { Group, PositionalAudio, AudioListener } from "three";

export interface SpatialAudioSourceRef {
  /** Feed a base64-encoded PCM16 chunk to be played spatially. */
  enqueueAudio: (base64: string) => void;
}

interface SpatialAudioSourceProps {
  sampleRate?: number;
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: "linear" | "inverse" | "exponential";
}

/**
 * A spatial audio source component that can be positioned in the scene and fed audio data in real-time.
 *
 * This component sets up a Three.js PositionalAudio source with a custom GainNode
 * as its source. The enqueueAudio method decodes incoming PCM16 audio chunks
 * and schedules them for seamless playback, ensuring that new chunks start
 * immediately after the previous ones without gaps.
 *
 * @param sampleRate The sample rate of the incoming audio data. Defaults to 16000 (ElevenLabs output).
 * @param refDistance The reference distance for the PositionalAudio (how far before attenuation starts). Defaults to 1.
 * @param rolloffFactor The rolloff factor for the PositionalAudio (how quickly it attenuates). Defaults to 1.
 * @param maxDistance The maximum distance at which the audio can be heard. Defaults to 50.
 * @param distanceModel The distance model for attenuation ("linear", "inverse", or "exponential"). Defaults to "inverse".
 */
export const SpatialAudioSource = forwardRef<
  SpatialAudioSourceRef,
  SpatialAudioSourceProps
>(function SpatialAudioSource(
  {
    sampleRate = 16000,
    refDistance = 1,
    rolloffFactor = 1,
    maxDistance = 50,
    distanceModel = "inverse",
  },
  ref,
) {
  const { camera } = useThree();
  const positionalAudioRef = useRef<PositionalAudio | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const listenerRef = useRef<AudioListener | null>(null);
  const scheduledTimeRef = useRef(0);
  const groupRef = useRef<Group>(null!);

  // 1. Create AudioListener, attach to camera, and ensure AudioContext is resumed.
  useEffect(() => {
    const group = groupRef.current;

    const listener = new AudioListener();
    camera.add(listener);
    listenerRef.current = listener;

    // 2. Create PositionalAudio and add to our group.
    const positionalAudio = new PositionalAudio(listener);
    positionalAudio.setRefDistance(refDistance);
    positionalAudio.setRolloffFactor(rolloffFactor);
    positionalAudio.setMaxDistance(maxDistance);
    positionalAudio.setDistanceModel(distanceModel);
    group.add(positionalAudio);
    positionalAudioRef.current = positionalAudio;

    // 3. Create a GainNode on the listener's AudioContext
    //    and set it as the PositionalAudio's source.
    //    This is the key – setNodeSource() hooks our custom node
    //    into Three's panner → listener → destination chain.
    const context = listener.context;
    const gain = context.createGain();
    gain.gain.value = 1.0;
    gainRef.current = gain;

    positionalAudio.setNodeSource(gain as unknown as AudioBufferSourceNode);

    // 4. Resume the AudioContext on the first user gesture.
    //    Browsers require a user interaction to start an AudioContext.
    //    Without this, scheduled audio sources silently fail.
    const resumeContext = () => {
      if (context.state === "suspended") {
        context.resume().then(() => {
          console.log("Three.js AudioContext resumed via user gesture");
        });
      }
    };

    // Try immediately (works if a gesture already happened).
    resumeContext();

    // Also listen for the next user interaction as a fallback.
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
      gain.disconnect();
      positionalAudio.disconnect();
      group.remove(positionalAudio);
      camera.remove(listener);
    };
  }, [camera, refDistance, rolloffFactor, maxDistance, distanceModel]);

  // 5. Expose enqueueAudio to parent via ref.
  const enqueueAudio = useCallback(
    (base64: string) => {
      const gain = gainRef.current;
      const listener = listenerRef.current;
      if (!gain || !listener) return;

      const context = listener.context;

      // Decode the PCM chunk.
      const samples = decodePcm16Base64(base64);

      // Create an AudioBuffer and fill it.
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);

      // Schedule seamless gapless playback.
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);

      const now = context.currentTime;
      const startTime = Math.max(now, scheduledTimeRef.current);
      source.start(startTime);

      // Track when this chunk ends so the next one starts right after.
      scheduledTimeRef.current = startTime + buffer.duration;
    },
    [sampleRate],
  );

  useImperativeHandle(ref, () => ({ enqueueAudio }), [enqueueAudio]);

  return <group ref={groupRef} />;
});

/**
 * Decode a base64-encoded PCM16 (signed 16-bit little-endian) chunk
 * into a normalized Float32Array suitable for Web Audio.
 *
 * @param base64 The base64 string representing PCM16 audio data.
 */
function decodePcm16Base64(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768; // normalize to [-1, 1].
  }
  return float32;
}
