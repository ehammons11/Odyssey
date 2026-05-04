import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Group, PositionalAudio, AudioLoader } from "three";
import { useAudioListener } from "@/hooks/useAudioListener";

export interface SpatialAudioSourceHandle {
  play: () => void;
  stop: () => void;
  pause: () => void;
}

export interface SpatialAudioSourceProps {
  // Spatial parameters
  refDistance?: number;
  rolloffFactor?: number;
  maxDistance?: number;
  distanceModel?: "linear" | "inverse" | "exponential";
  // Provide either mediaStream (live audio) or url (file) — not both
  mediaStream?: MediaStream | null;
  url?: string;
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
  playbackRate?: number;
}

/**
 * 3D-spatialized audio source powered by Three.js PositionalAudio.
 *
 * Provide **either** a `mediaStream` (for live audio, e.g. voice chat)
 * or a `url` (for a sound file loaded via AudioLoader).
 *
 * Pass a ref to get an imperative `{ play, stop, pause }` handle
 * (only meaningful for file-based sources).
 */
export const SpatialAudioSource = forwardRef<
  SpatialAudioSourceHandle,
  SpatialAudioSourceProps
>(function SpatialAudioSource(props, ref) {
  const {
    refDistance = 1,
    rolloffFactor = 1,
    maxDistance = 50,
    distanceModel = "inverse",
    mediaStream,
    url,
    volume = 1,
    loop = false,
    autoplay = true,
    playbackRate,
  } = props;

  const listener = useAudioListener();
  const audioRef = useRef<PositionalAudio | null>(null);
  const groupRef = useRef<Group>(null!);
  const bufferReady = useRef(false);

  useImperativeHandle(ref, () => ({
    play() {
      const audio = audioRef.current;
      if (audio && bufferReady.current && !audio.isPlaying) audio.play();
    },
    stop() {
      const audio = audioRef.current;
      if (audio?.isPlaying) audio.stop();
    },
    pause() {
      const audio = audioRef.current;
      if (audio?.isPlaying) audio.pause();
    },
  }));

  // Create and configure PositionalAudio node.
  useEffect(() => {
    const group = groupRef.current;
    const positionalAudio = new PositionalAudio(listener);
    positionalAudio.setRefDistance(refDistance);
    positionalAudio.setRolloffFactor(rolloffFactor);
    positionalAudio.setMaxDistance(maxDistance);
    positionalAudio.setDistanceModel(distanceModel);
    group.add(positionalAudio);
    audioRef.current = positionalAudio;

    return () => {
      if (positionalAudio.isPlaying) positionalAudio.stop();
      try {
        positionalAudio.disconnect();
      } catch {
        /* may not be connected */
      }
      group.remove(positionalAudio);
      audioRef.current = null;
      bufferReady.current = false;
    };
  }, [listener, refDistance, rolloffFactor, maxDistance, distanceModel]);

  // MediaStream source.
  useEffect(() => {
    if (!mediaStream) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.setMediaStreamSource(mediaStream);

    return () => {
      try {
        audio.disconnect();
      } catch {
        /* may not be connected */
      }
    };
  }, [mediaStream]);

  // File source.
  useEffect(() => {
    if (!url) return;
    const audio = audioRef.current;
    if (!audio) return;

    const loader = new AudioLoader();
    let cancelled = false;

    loader.load(url, (buffer) => {
      if (cancelled) return;
      audio.setBuffer(buffer);
      audio.setLoop(loop);
      audio.setVolume(volume);
      if (playbackRate !== undefined) audio.setPlaybackRate(playbackRate);
      bufferReady.current = true;
      if (autoplay && !audio.isPlaying) audio.play();
    });

    return () => {
      cancelled = true;
      if (audio.isPlaying) audio.stop();
      bufferReady.current = false;
    };
  }, [url, loop, volume, autoplay, playbackRate]);

  return <group ref={groupRef} />;
});
