import { resolveEmotionTag } from "@/config/emotionTagMap";

type EmotionCallback = (preset: string, rawTag: string) => void;

/**
 * Creates a stateful parser for streaming [tag] emotion snippets.
 */
export function createEmotionParser(onEmotion: EmotionCallback) {
  let isCapturing = false;
  let tagBuffer = "";

  return {
    feed(delta: string) {
      for (const char of delta) {
        if (char === "[") {
          isCapturing = true;
          tagBuffer = "";
          continue;
        }

        if (char === "]") {
          if (!isCapturing) {
            continue;
          }

          const rawTag = tagBuffer.trim();
          isCapturing = false;
          tagBuffer = "";

          if (rawTag.length === 0) {
            continue;
          }

          const preset = resolveEmotionTag(rawTag);
          if (preset) {
            onEmotion(preset, rawTag);
          }
          // Unknown tags are intentionally ignored.

          continue;
        }

        if (isCapturing) {
          tagBuffer += char;
        }
      }
    },

    reset() {
      isCapturing = false;
      tagBuffer = "";
    },
  };
}
