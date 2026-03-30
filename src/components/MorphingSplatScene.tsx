import { SplatMesh, SparkRenderer, dyno } from "@sparkjsdev/spark";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { environmentStore } from "../stores/environmentStore";

interface MorphingSplatSceneProps {
  /**
   * Splat file URLs for each environment. An `undefined` entry means that
   * environment has no splat (e.g. a "default" environment). The array
   * index must match the environment index in the store.
   */
  urls: (string | undefined)[];
  /** Optional per-environment positions for the splat meshes. */
  positions?: ([number, number, number] | undefined)[];
  /** Duration of the morph transition in seconds. Defaults to 3. */
  transitionDuration?: number;
  /** Radius of the random scatter during the morph. Defaults to 2. */
  randomRadius?: number;
}

const WORLD_POSITION = new Vector3(0, 1, 0);

/**
 * Creates a Dyno node that implements the scatter-morph shader.
 *
 * Inputs:
 *  - gsplat: the current gaussian splat
 *  - fromIndex / toIndex: which objects are transitioning
 *  - progress: 0 → 1 animation parameter (0 = fully showing "from", 1 = fully showing "to")
 *  - objectIndex: which object this mesh represents
 *  - randomRadius: scatter radius
 *
 * First half (progress 0–0.5): "from" splats scatter outward and fade.
 * Second half (progress 0.5–1): "to" splats coalesce inward and appear.
 * Non-participating objects are invisible.
 */
function createMorphDyno() {
  return new dyno.Dyno({
    inTypes: {
      gsplat: dyno.Gsplat,
      fromIndex: "int",
      toIndex: "int",
      progress: "float",
      objectIndex: "int",
      randomRadius: "float",
    },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [
      dyno.unindent(`
        vec3 morphHash3(int n) {
          float x = float(n);
          return fract(sin(vec3(x, x + 1.0, x + 2.0)) * 43758.5453123);
        }
        float morphEase(float x) { return x * x * (3.0 - 2.0 * x); }
        vec3 morphRandPos(int splatIndex, float radius) {
          vec3 h = morphHash3(splatIndex);
          float theta = 6.28318530718 * h.x;
          float r = radius * sqrt(h.y);
          return vec3(r * cos(theta), 0.0, r * sin(theta));
        }
      `),
    ],
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        int idx = ${inputs.objectIndex};
        int fromIdx = ${inputs.fromIndex};
        int toIdx = ${inputs.toIndex};
        float progress = ${inputs.progress};

        vec3 rp = morphRandPos(int(${inputs.gsplat}.index), ${inputs.randomRadius});
        vec3 rpMid = mix(${inputs.gsplat}.center, rp, 0.7);

        float alpha = 0.0;
        vec3 pos = ${inputs.gsplat}.center;
        vec3 origScale = ${inputs.gsplat}.scales;
        vec3 small = origScale * 0.2;

        bool noTransition = fromIdx == toIdx;

        if (noTransition && idx == fromIdx) {
          alpha = 1.0;
        } else if (idx == fromIdx) {
          if (progress < 0.5) {
            float s = progress / 0.5;
            alpha = 1.0 - morphEase(s) * 0.5;
            pos = mix(${inputs.gsplat}.center, rpMid, morphEase(s));
            ${outputs.gsplat}.scales = mix(origScale, small, morphEase(s));
          } else {
            alpha = 0.0;
            pos = rpMid;
            ${outputs.gsplat}.scales = small;
          }
        } else if (idx == toIdx) {
          if (progress <= 0.5) {
            alpha = 0.0;
            pos = rpMid;
            ${outputs.gsplat}.scales = small;
          } else {
            float s = (progress - 0.5) / 0.5;
            alpha = max(morphEase(s), 0.5);
            pos = mix(rpMid, ${inputs.gsplat}.center, morphEase(s));
            ${outputs.gsplat}.scales = mix(small, origScale, morphEase(s));
          }
        }

        ${outputs.gsplat}.center = pos;
        ${outputs.gsplat}.rgba.a = ${inputs.gsplat}.rgba.a * alpha;
      `),
  });
}

/**
 * Wraps the morph Dyno into a `dynoBlock` that can be assigned as a
 * `SplatMesh.worldModifier`.
 */
function createMorphModifier(
  fromIndex: ReturnType<typeof dyno.dynoInt>,
  toIndex: ReturnType<typeof dyno.dynoInt>,
  progress: ReturnType<typeof dyno.dynoFloat>,
  objectIndex: ReturnType<typeof dyno.dynoInt>,
  randomRadius: ReturnType<typeof dyno.dynoFloat>,
) {
  const dyn = createMorphDyno();
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => ({
      gsplat: dyn.apply({
        gsplat,
        fromIndex,
        toIndex,
        progress,
        objectIndex,
        randomRadius,
      }).gsplat,
    }),
  );
}

/**
 * Loads all gaussian splat meshes up-front and renders the active one.
 * When the environment store's active index changes, a scatter-morph
 * transition plays between the outgoing and incoming splats.
 */
export function MorphingSplatScene({
  urls,
  positions,
  transitionDuration = 3.0,
  randomRadius = 5.0,
}: MorphingSplatSceneProps) {
  const { gl, scene } = useThree();

  // Shared dyno uniforms — created once, mutated each frame.
  const fromIndexRef = useRef<ReturnType<typeof dyno.dynoInt> | null>(null);
  const toIndexRef = useRef<ReturnType<typeof dyno.dynoInt> | null>(null);
  const progressRef = useRef<ReturnType<typeof dyno.dynoFloat> | null>(null);
  const radiusRef = useRef<ReturnType<typeof dyno.dynoFloat> | null>(null);

  if (!fromIndexRef.current) fromIndexRef.current = dyno.dynoInt(0);
  if (!toIndexRef.current) toIndexRef.current = dyno.dynoInt(0);
  if (!progressRef.current) progressRef.current = dyno.dynoFloat(1.0);
  if (!radiusRef.current) radiusRef.current = dyno.dynoFloat(randomRadius);

  const meshesRef = useRef<SplatMesh[]>([]);

  /** Internal animation state (not reactive — driven by useFrame). */
  const transitionState = useRef({
    displayedIndex: 0,
    progress: 1.0,
    animating: false,
  });

  // Load all splat meshes and wire up morph modifiers.
  useEffect(() => {
    let disposed = false;
    const spark = new SparkRenderer({ renderer: gl });
    scene.add(spark);

    const meshes: SplatMesh[] = [];

    async function loadAll() {
      for (let i = 0; i < urls.length; i++) {
        if (disposed) return;

        const url = urls[i];
        // Skip environments with no splat (e.g. a default environment).
        if (!url) continue;

        const mesh = new SplatMesh({ url });
        await mesh.initialized;
        if (disposed) return;

        const pos = positions?.[i];
        if (pos) mesh.position.set(...pos);

        // Assign the morph modifier so the dyno shader controls visibility.
        // objectIndex must match the environment index in the store, NOT the
        // mesh array index, so that from/to indices line up correctly.
        mesh.worldModifier = createMorphModifier(
          fromIndexRef.current!,
          toIndexRef.current!,
          progressRef.current!,
          dyno.dynoInt(i),
          radiusRef.current!,
        );
        mesh.updateGenerator();

        scene.add(mesh);
        meshes.push(mesh);
      }

      meshesRef.current = meshes;

      if (!disposed) {
        spark.renderEnvMap({ scene, worldCenter: WORLD_POSITION });
      }
    }

    loadAll();

    return () => {
      disposed = true;
      meshes.forEach((m) => scene.remove(m));
      scene.remove(spark);
      meshesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, urls, positions]);

  // Drive the morph animation each frame.
  useFrame((_, delta) => {
    const state = transitionState.current;
    const targetIndex = environmentStore.activeIndex;
    const storeTransitioning = environmentStore.isTransitioning;

    // Detect a new transition request from the store.
    if (
      storeTransitioning &&
      !state.animating &&
      targetIndex !== state.displayedIndex
    ) {
      state.animating = true;
      state.progress = 0;

      fromIndexRef.current!.value = state.displayedIndex;
      toIndexRef.current!.value = targetIndex;
      progressRef.current!.value = 0;
    }

    // Advance the animation.
    if (state.animating) {
      state.progress = Math.min(
        state.progress + delta / transitionDuration,
        1.0,
      );
      progressRef.current!.value = state.progress;

      // Push uniform changes so the GPU picks them up.
      for (const m of meshesRef.current) {
        m.updateVersion();
      }

      // Transition complete — snap to static display of the target.
      if (state.progress >= 1.0) {
        state.animating = false;
        state.displayedIndex = targetIndex;

        fromIndexRef.current!.value = targetIndex;
        toIndexRef.current!.value = targetIndex;
        progressRef.current!.value = 1.0;

        environmentStore.completeTransition();
      }
    }
  });

  return null;
}
