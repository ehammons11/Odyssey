import { useEffect, useState, type ReactNode } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { AudioListener, Vector3, Quaternion } from "three";
import { AudioContext } from "@/hooks/useAudioListener";

const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3();

/**
 * Provides a single Three.js AudioListener whose world transform is
 * manually synced to the camera's head pose each frame.
 *
 * The listener is deliberately NOT parented to the camera. In XR the
 * camera is an ArrayCamera whose matrixWorld is recomputed per-eye
 * during stereo rendering; a parented listener would have its Web Audio
 * position overwritten twice per frame (once per eye), destroying
 * spatialization. By keeping the listener out of the scene graph and
 * syncing it once in useFrame we get a single, stable head-pose update.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const camera = useThree((s) => s.camera);
  const [listener] = useState(() => new AudioListener());

  // Handle AudioContext resumption on user gesture.
  useEffect(() => {
    const ctx = listener.context;
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume();
    };

    resume();

    const gestures = ["click", "touchstart", "keydown"] as const;
    const onGesture = () => {
      resume();
      gestures.forEach((e) => document.removeEventListener(e, onGesture));
    };
    gestures.forEach((e) =>
      document.addEventListener(e, onGesture, { once: true }),
    );

    return () => {
      gestures.forEach((e) => document.removeEventListener(e, onGesture));
    };
  }, [listener]);

  // Sync the listener to the camera's head pose once per frame.
  useFrame(() => {
    camera.matrixWorld.decompose(_position, _quaternion, _scale);
    listener.position.copy(_position);
    listener.quaternion.copy(_quaternion);
    listener.updateMatrixWorld(true);
  });

  return (
    <AudioContext.Provider value={listener}>{children}</AudioContext.Provider>
  );
}
