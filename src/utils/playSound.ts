const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Play a sound effect from the public directory.
 * Caches Audio elements so repeated calls reuse the same buffer.
 *
 * @param path - Path relative to the public folder, e.g. "/audio/button.wav"
 * @param volume - Volume from 0 to 1 (default: 1)
 */
export function playSound(path: string, volume = 1) {
  let audio = audioCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audioCache.set(path, audio);
  }
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play();
}
