import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Audio as ThreeAudio, AudioLoader } from "three";
import { useAudioListener } from "@/hooks/useAudioListener";

export interface AudioSourceHandle {
  play: () => void;
  stop: () => void;
  pause: () => void;
}

export interface AudioSourceProps {
  url: string;
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
  playbackRate?: number;
  detune?: number;
}

/**
 * Non-spatial audio source powered by Three.js Audio.
 * Plays at uniform volume regardless of camera position —
 * ideal for music, UI sounds, and ambience.
 *
 * Pass a ref to get an imperative `{ play, stop, pause }` handle.
 */
export const AudioSource = forwardRef<AudioSourceHandle, AudioSourceProps>(
  function AudioSource(
    {
      url,
      volume = 1,
      loop = false,
      autoplay = true,
      playbackRate = 1,
      detune = 0,
    },
    ref,
  ) {
    const listener = useAudioListener();
    const audioRef = useRef<ThreeAudio | null>(null);
    const bufferReady = useRef(false);

    useImperativeHandle(ref, () => ({
      play() {
        const a = audioRef.current;
        if (a && bufferReady.current && !a.isPlaying) a.play();
      },
      stop() {
        const a = audioRef.current;
        if (a?.isPlaying) a.stop();
      },
      pause() {
        const a = audioRef.current;
        if (a?.isPlaying) a.pause();
      },
    }));

    // Create the Three.js Audio node.
    useEffect(() => {
      const audio = new ThreeAudio(listener);
      audioRef.current = audio;

      return () => {
        if (audio.isPlaying) audio.stop();
        try {
          audio.disconnect();
        } catch {
          /* may not be connected */
        }
        audioRef.current = null;
        bufferReady.current = false;
      };
    }, [listener]);

    // Load buffer and apply properties.
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio || !url) return;

      const loader = new AudioLoader();
      let cancelled = false;

      loader.load(url, (buffer) => {
        if (cancelled) return;
        audio.setBuffer(buffer);
        audio.setVolume(volume);
        audio.setLoop(loop);
        audio.setPlaybackRate(playbackRate);
        audio.setDetune(detune);
        bufferReady.current = true;
        if (autoplay && !audio.isPlaying) {
          audio.play();
        }
      });

      return () => {
        cancelled = true;
        if (audio.isPlaying) audio.stop();
        bufferReady.current = false;
      };
    }, [url, volume, loop, autoplay, playbackRate, detune]);

    return null;
  },
);
