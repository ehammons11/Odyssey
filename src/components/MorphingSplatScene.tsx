import {
  SplatMesh,
  SparkRenderer,
  PackedSplats,
  dyno,
} from "@sparkjsdev/spark";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { environmentStore } from "../stores/environmentStore";
import { AudioSource, type AudioSourceHandle } from "./audio/AudioSource";

interface MorphingSplatSceneProps {
  /**
   * Splat file URLs for each environment. An `undefined` entry means that
   * environment has no splat (e.g. a "default" environment). The array
   * index must match the environment index in the store.
   */
  urls: (string | undefined)[];
  /** Optional per-environment positions for the splat meshes. */
  positions?: ([number, number, number] | undefined)[];
  /** Duration of the transition in seconds. Defaults to 1.5. */
  transitionDuration?: number;
}

/**
 * GLSL slerp for quaternion interpolation (matches spark's built-in slerp).
 * ponytail: spark defines slerp in its shader globals, but we keep a local
 * copy to avoid depending on compilation order.
 */
const SLERP_GLSL = `
vec4 morphSlerp(vec4 q1, vec4 q2, float t) {
  float cosHalfTheta = dot(q1, q2);
  if (abs(cosHalfTheta) >= 0.999) return q1;
  if (cosHalfTheta < 0.0) { q2 = -q2; cosHalfTheta = -cosHalfTheta; }
  float halfTheta = acos(cosHalfTheta);
  float sinHalfTheta = sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  float ratioA = sin((1.0 - t) * halfTheta) / sinHalfTheta;
  float ratioB = sin(t * halfTheta) / sinHalfTheta;
  return q1 * ratioA + q2 * ratioB;
}
`;

/**
 * Smoothstep helper for GLSL.
 */
const EASE_GLSL = `
float morphEase(float x) { return x * x * (3.0 - 2.0 * x); }
`;

/**
 * Transition Dyno — blends between two splat states.
 *
 * Directly adapted from spark's lofi example `transitionSplats`:
 * interpolates center, scales, quaternion (slerp), and rgba via mix.
 */
function createTransitionDyno() {
  return new dyno.Dyno({
    inTypes: {
      gsplat1: dyno.Gsplat,
      gsplat2: dyno.Gsplat,
      t: "float",
    },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [SLERP_GLSL],
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat1};
        ${outputs.gsplat}.center = mix(${inputs.gsplat1}.center, ${inputs.gsplat2}.center, ${inputs.t});
        ${outputs.gsplat}.scales = mix(${inputs.gsplat1}.scales, ${inputs.gsplat2}.scales, ${inputs.t});
        ${outputs.gsplat}.quaternion = morphSlerp(${inputs.gsplat1}.quaternion, ${inputs.gsplat2}.quaternion, ${inputs.t});
        ${outputs.gsplat}.rgba = mix(${inputs.gsplat1}.rgba, ${inputs.gsplat2}.rgba, ${inputs.t});
      `),
  });
}

/**
 * Fade Dyno — multiplies splat alpha by a uniform value.
 * Used for the initial fade-in (no splat → first splat) and the final
 * fade-out (last splat → no splat).
 */
function createFadeDyno() {
  return new dyno.Dyno({
    inTypes: { gsplat: dyno.Gsplat, alpha: "float" },
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        ${outputs.gsplat}.rgba.a = ${inputs.gsplat}.rgba.a * ${inputs.alpha};
      `),
  });
}

const LOD_RECOVERY_DURATION = 0.5;
const TRANSITION_LOD_SCALE = 0.01;

/**
 * Loads all gaussian splats as PackedSplats up-front and renders a single
 * SplatMesh. When the environment store's active index changes, a blend
 * transition plays between the outgoing and incoming splat states —
 * directly matching the spark lofi example's `transitionSplats` approach.
 *
 * - Splat → splat: `objectModifier` blends center/scales/quaternion/rgba.
 * - No splat → splat (first appearance): fade alpha 0 → 1.
 * - Splat → no splat (final vanish): fade alpha 1 → 0.
 */
export function MorphingSplatScene({
  urls,
  positions,
  transitionDuration = 1.5,
}: MorphingSplatSceneProps) {
  const { gl, scene } = useThree();
  const longWhooshSound = useRef<AudioSourceHandle>(null);
  const shortWhooshSound = useRef<AudioSourceHandle>(null);

  // Shared dyno uniforms.
  const transitionT = useRef(dyno.dynoFloat(0));
  const fadeAlpha = useRef(dyno.dynoFloat(0));

  const packedRef = useRef<Map<number, PackedSplats>>(new Map());
  const meshRef = useRef<SplatMesh | null>(null);
  const sparkRef = useRef<SparkRenderer | null>(null);

  /** Internal animation state. */
  const state = useRef({
    displayedIndex: -1, // -1 = no splat shown yet
    animating: false,
    progress: 0,
    recoveringLod: false,
    lodRecoveryProgress: 0,
    /** "blend" | "fade-in" | "fade-out" */
    mode: "blend" as "blend" | "fade-in" | "fade-out",
  });

  // Load all PackedSplats + create single SplatMesh.
  useEffect(() => {
    let disposed = false;
    const spark = new SparkRenderer({
      renderer: gl,
      maxStdDev: Math.sqrt(5),
      enableLod: true,
    });
    sparkRef.current = spark;
    scene.add(spark);

    const packedMap = new Map<number, PackedSplats>();

    async function loadAll() {
      for (let i = 0; i < urls.length; i++) {
        if (disposed) return;
        const url = urls[i];
        if (!url) continue;

        const packed = new PackedSplats({ url, lod: true });
        await packed.initialized;
        if (disposed) return;
        packedMap.set(i, packed);
      }

      packedRef.current = packedMap;

      // Create the single SplatMesh — no packedSplats yet (no splat at start).
      const mesh = new SplatMesh();
      const pos = positions?.[0];
      if (pos) mesh.position.set(...pos);
      meshRef.current = mesh;
      scene.add(mesh);

      // Start with no splat visible.
      mesh.visible = false;
    }

    loadAll();

    return () => {
      disposed = true;
      if (meshRef.current) scene.remove(meshRef.current);
      scene.remove(spark);
      sparkRef.current = null;
      meshRef.current = null;
      packedMap.forEach((p) => p.dispose());
      packedRef.current = new Map();
    };
  }, [gl, scene, urls, positions]);

  // Drive the transition each frame.
  useFrame((_, delta) => {
    const s = state.current;
    const targetIndex = environmentStore.activeIndex;
    const storeTransitioning = environmentStore.isTransitioning;

    // Detect a new transition request from the store.
    if (storeTransitioning && !s.animating && targetIndex !== s.displayedIndex) {
      const mesh = meshRef.current;
      const packed = packedRef.current;
      if (!mesh) return;

      const fromPacked = s.displayedIndex >= 0 ? packed.get(s.displayedIndex) : null;
      const toPacked = packed.get(targetIndex);

      s.animating = true;
      s.progress = 0;

      if (fromPacked && toPacked) {
        // Splat → splat: blend transition (lofi-style).
        s.mode = "blend";
        transitionT.current.value = 0;

        // Set up objectModifier to blend from current to target.
        mesh.objectModifier = dyno.dynoBlock(
          { gsplat: dyno.Gsplat },
          { gsplat: dyno.Gsplat },
          ({ gsplat }) => {
            const { index } = dyno.splitGsplat(gsplat).outputs;
            // ponytail: use live gsplat as source (lofi pattern) — readPackedSplat
            // on a non-active packed splat returns garbage; the mesh's current
            // gsplat already holds the from-state.
            const splat2 = dyno.readPackedSplat(toPacked.dyno, index);
            const t = dyno.smoothstep(
              dyno.dynoConst("float", 0),
              dyno.dynoConst("float", 1),
              transitionT.current,
            );
            return {
              gsplat: createTransitionDyno().apply({
                gsplat1: gsplat,
                gsplat2: splat2,
                t,
              }).gsplat,
            };
          },
        );
        mesh.updateGenerator();
        mesh.visible = true;

        // Drop LOD during transition.
        if (sparkRef.current)
          sparkRef.current.lodSplatScale = TRANSITION_LOD_SCALE;

        longWhooshSound.current?.play();
      } else if (!fromPacked && toPacked) {
        // No splat → splat: fade-in.
        s.mode = "fade-in";
        fadeAlpha.current.value = 0;

        // Switch to target packed splats immediately, fade alpha.
        mesh.packedSplats = toPacked;
        mesh.objectModifier = dyno.dynoBlock(
          { gsplat: dyno.Gsplat },
          { gsplat: dyno.Gsplat },
          ({ gsplat }) => ({
            gsplat: createFadeDyno().apply({
              gsplat,
              alpha: fadeAlpha.current,
            }).gsplat,
          }),
        );
        mesh.updateGenerator();
        mesh.visible = true;

        if (sparkRef.current)
          sparkRef.current.lodSplatScale = TRANSITION_LOD_SCALE;

        shortWhooshSound.current?.play();
      } else if (fromPacked && !toPacked) {
        // Splat → no splat: fade-out.
        s.mode = "fade-out";
        fadeAlpha.current.value = 1;

        // Keep current packed splats, fade alpha to 0.
        mesh.objectModifier = dyno.dynoBlock(
          { gsplat: dyno.Gsplat },
          { gsplat: dyno.Gsplat },
          ({ gsplat }) => ({
            gsplat: createFadeDyno().apply({
              gsplat,
              alpha: fadeAlpha.current,
            }).gsplat,
          }),
        );
        mesh.updateGenerator();
        mesh.visible = true;

        if (sparkRef.current)
          sparkRef.current.lodSplatScale = TRANSITION_LOD_SCALE;

        longWhooshSound.current?.play();
      } else {
        // No splat → no splat: instant.
        s.animating = false;
        s.displayedIndex = targetIndex;
        mesh.visible = false;
        environmentStore.completeTransition();
      }
    }

    // Advance the animation.
    if (s.animating) {
      s.progress = Math.min(s.progress + delta / transitionDuration, 1.0);
      const eased = s.progress * s.progress * (3 - 2 * s.progress);

      const mesh = meshRef.current;
      if (!mesh) return;

      if (s.mode === "blend") {
        transitionT.current.value = eased;
      } else if (s.mode === "fade-in") {
        fadeAlpha.current.value = eased;
      } else if (s.mode === "fade-out") {
        fadeAlpha.current.value = 1.0 - eased;
      }

      mesh.updateVersion();

      // Transition complete.
      if (s.progress >= 1.0) {
        s.animating = false;
        s.recoveringLod = true;
        s.lodRecoveryProgress = 0;

        const targetIndex = environmentStore.activeIndex;
        const packed = packedRef.current;

        if (s.mode === "blend") {
          // Swap to target packed splats, remove objectModifier.
          const toPacked = packed.get(targetIndex);
          if (toPacked) mesh.packedSplats = toPacked;
          mesh.objectModifier = undefined;
          mesh.updateGenerator();
        } else if (s.mode === "fade-in") {
          // Fade-in done: remove fade modifier.
          mesh.objectModifier = undefined;
          mesh.updateGenerator();
        } else if (s.mode === "fade-out") {
          // Fade-out done: hide mesh, clear packed splats.
          mesh.visible = false;
          mesh.packedSplats = undefined;
          mesh.objectModifier = undefined;
          mesh.updateGenerator();
        }

        s.displayedIndex = targetIndex;
        environmentStore.completeTransition();
      }
    }

    // Smoothly ramp LOD detail back up after transition.
    if (s.recoveringLod) {
      s.lodRecoveryProgress = Math.min(
        s.lodRecoveryProgress + delta / LOD_RECOVERY_DURATION,
        1.0,
      );
      const t =
        s.lodRecoveryProgress *
        s.lodRecoveryProgress *
        (3 - 2 * s.lodRecoveryProgress);
      if (sparkRef.current) {
        sparkRef.current.lodSplatScale =
          TRANSITION_LOD_SCALE + (1.0 - TRANSITION_LOD_SCALE) * t;
      }
      if (s.lodRecoveryProgress >= 1.0) {
        s.recoveringLod = false;
        if (sparkRef.current) sparkRef.current.lodSplatScale = 1.0;
      }
    }
  });

  return (
    <>
      <AudioSource
        ref={longWhooshSound}
        url="/audio/whoosh.wav"
        autoplay={false}
      />
      <AudioSource
        ref={shortWhooshSound}
        url="/audio/whooshShort.wav"
        autoplay={false}
      />
    </>
  );
}
