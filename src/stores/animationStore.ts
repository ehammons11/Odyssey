import { deepSignal } from "deepsignal";

/**
 * Schema for all animatable character properties.
 *
 * Each property is a continuous value that can be smoothly interpolated.
 * Populate emotion presets by tweaking values with leva, then copy the
 * resulting numbers into the EMOTIONS map below.
 */
export type AnimationParams = {
  /** Seconds between blinks. Lower = more frequent. */
  blinkRate: number;
  /** 0 = locked eye contact, 1 = frantic random movement. */
  eyeFrantic: number;
  /** Resting wing angle bias in radians. Negative = drooped, positive = arched high. */
  wingArch: number;
  /** Base wing flap speed. */
  flapSpeed: number;
  /** 0 = smooth float, 1 = erratic zigzag flight path. */
  flightZigzag: number;
  /** Red channel of the wing color bias (0–1). */
  wingColorBiasR: number;
  /** Green channel of the wing color bias (0–1). */
  wingColorBiasG: number;
  /** Blue channel of the wing color bias (0–1). */
  wingColorBiasB: number;
  /** 0 = full iridescent, 1 = fully dominated by bias color. */
  wingColorBiasStrength: number;
  /** Fraction of gradient sampled. 1 = full gradient, smaller = zoomed in. */
  wingGradientZoom: number;
  /** Offset into the gradient when zoomed (0–1). */
  wingGradientOffset: number;
  /** 0 = squint/closed, 1 = normal, >1 = wide open. */
  eyeOpenness: number;
};

export const DEFAULT_PARAMS: AnimationParams = {
  blinkRate: 3.0,
  eyeFrantic: 0.0,
  wingArch: 0.0,
  flapSpeed: 15.0,
  flightZigzag: 0.0,
  wingColorBiasR: 1.0,
  wingColorBiasG: 1.0,
  wingColorBiasB: 1.0,
  wingColorBiasStrength: 0.0,
  wingGradientZoom: 1.0,
  wingGradientOffset: 0.0,
  eyeOpenness: 1.0,
};

const PARAM_KEYS = Object.keys(DEFAULT_PARAMS) as (keyof AnimationParams)[];

/**
 * Named emotion presets.
 *
 * Populate these by using leva to tweak the animation parameters until they
 * match a specific emotion, then paste the resulting values here.
 */
export const EMOTIONS: Record<string, AnimationParams> = {
  neutral: { ...DEFAULT_PARAMS },
  curious: {
    ...DEFAULT_PARAMS,
    eyeOpenness: 1.3,
    eyeFrantic: 0.15,
    flapSpeed: 18.0,
    wingArch: 0.15,
    flightZigzag: 0.1,
  },
  excited: {
    ...DEFAULT_PARAMS,
    eyeOpenness: 1.4,
    eyeFrantic: 0.4,
    flapSpeed: 25.0,
    wingArch: 0.4,
    flightZigzag: 0.5,
    wingColorBiasR: 1.0,
    wingColorBiasG: 0.8,
    wingColorBiasB: 0.2,
    wingColorBiasStrength: 0.3,
  },
  calm: {
    ...DEFAULT_PARAMS,
    blinkRate: 5.0,
    eyeFrantic: 0.0,
    flapSpeed: 8.0,
    wingArch: -0.1,
    flightZigzag: 0.0,
    eyeOpenness: 0.8,
  },
  sad: {
    ...DEFAULT_PARAMS,
    blinkRate: 4.0,
    eyeFrantic: 0.05,
    flapSpeed: 6.0,
    wingArch: -0.4,
    flightZigzag: 0.0,
    wingColorBiasR: 0.3,
    wingColorBiasG: 0.3,
    wingColorBiasB: 0.8,
    wingColorBiasStrength: 0.4,
    wingGradientZoom: 0.4,
    wingGradientOffset: 0.6,
    eyeOpenness: 0.6,
  },
  angry: {
    ...DEFAULT_PARAMS,
    blinkRate: 1.5,
    eyeFrantic: 0.6,
    flapSpeed: 28.0,
    wingArch: 0.5,
    flightZigzag: 0.7,
    wingColorBiasR: 1.0,
    wingColorBiasG: 0.1,
    wingColorBiasB: 0.1,
    wingColorBiasStrength: 0.6,
    wingGradientZoom: 0.3,
    wingGradientOffset: 0.0,
    eyeOpenness: 0.5,
  },
  fearful: {
    ...DEFAULT_PARAMS,
    blinkRate: 1.0,
    eyeFrantic: 0.8,
    flapSpeed: 30.0,
    wingArch: 0.3,
    flightZigzag: 0.8,
    eyeOpenness: 1.5,
  },
};

/**
 * Reactive animation store.
 *
 * Properties on this store represent the *target* values for each animation
 * parameter. Components read these in their `useFrame` loops and lerp their
 * internal (current) values toward them, producing smooth transitions.
 *
 * @property activeEmotion  Name of the currently active emotion preset.
 * @property lerpSpeed      Exponential interpolation rate (higher = snappier).
 *
 * @method setEmotion  Switch all params to a named emotion preset.
 */
export const animationStore = deepSignal({
  activeEmotion: "neutral" as string,
  lerpSpeed: 3.0,

  // Current target values — components lerp toward these.
  ...DEFAULT_PARAMS,

  setEmotion(name: string) {
    const emotion = EMOTIONS[name];

    if (!emotion) throw new Error(`Unknown emotion preset: ${name}`);

    animationStore.activeEmotion = name;
    for (const key of PARAM_KEYS) {
      animationStore[key] = emotion[key];
    }
  },
});
