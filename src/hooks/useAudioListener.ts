import { createContext, useContext } from "react";
import type { AudioListener } from "three";

export const AudioContext = createContext<AudioListener | null>(null);

/**
 * Returns the shared Three.js AudioListener from the nearest AudioProvider.
 * Throws if called outside an AudioProvider.
 */
export function useAudioListener() {
  const listener = useContext(AudioContext);
  if (!listener) {
    throw new Error("useAudioListener must be used within an <AudioProvider>");
  }
  return listener;
}
