/**
 * Maps raw LLM-generated tags to animation emotion presets.
 */
export const emotionTagMap: Record<string, string> = {
  neutral: "neutral",
  default: "neutral",
  calm: "calm",
  reflective: "calm",
  serene: "calm",
  peaceful: "calm",
  contemplative: "calm",
  curious: "curious",
  intrigued: "curious",
  wondering: "curious",
  inquisitive: "curious",
  excited: "excited",
  enthusiastic: "excited",
  thrilled: "excited",
  elated: "excited",
  sad: "sad",
  melancholy: "sad",
  somber: "sad",
  sorrowful: "sad",
};

/**
 * Resolves a tag to a preset name using case-insensitive lookup.
 */
export function resolveEmotionTag(tag: string): string | null {
  return emotionTagMap[tag.trim().toLowerCase()] ?? null;
}
