import { PackedSplats, SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { environmentStore } from "../stores/environmentStore";
import { AudioSource, type AudioSourceHandle } from "./audio/AudioSource";
import {
  createCrossModifier,
  createFadeModifier,
} from "../lib/lofiTransition/transitionModifier";

interface LofiSplatSceneProps {
  /**
   * Splat file URLs for each environment. An `undefined` entry means that
   * environment has no splat (e.g. the "Default" environment). The array
   * index must match the environment index in the store.
   *
   * Files must be flat (non-LoD) formats — .spz/.ply/etc — and should all
   * have the SAME splat count for a clean transition (unpaired splats
   * shrink out instead of morphing). .rad LoD files are NOT supported.
   */
  urls: (string | undefined)[];
  /** Optional per-environment positions for the splat world. */
  positions?: ([number, number, number] | undefined)[];
  /** Duration of the transition in seconds. Defaults to 2.5. */
  transitionDuration?: number;
}

function smoothstep01(x: number): number {
  return x * x * (3 - 2 * x);
}

type TransitionMode = "cross" | "in" | "out";

/**
 * Splat environment scene with lofi-worlds-style transitions
 * (github.com/sparkjsdev/spark examples/lofi): ONE SplatMesh whose
 * packedSplats swaps between pre-loaded worlds. During a transition an
 * object-space modifier interpolates every splat toward the same-index
 * splat of the incoming world (center/scale mix, quaternion slerp, color
 * mix), then the mesh swaps to the incoming PackedSplats and drops the
 * modifier.
 *
 * The mesh is created bare (`new SplatMesh()`) on purpose: a mesh created
 * with a `url` pins `this.splats` to the initial PackedSplats inside
 * asyncInitialize, after which `mesh.packedSplats = next` swaps are
 * silently ignored.
 */
export function LofiSplatScene({
  urls,
  positions,
  transitionDuration = 2.5,
}: LofiSplatSceneProps) {
  const { gl, scene } = useThree();
  const longWhooshSound = useRef<AudioSourceHandle>(null);
  const shortWhooshSound = useRef<AudioSourceHandle>(null);

  // Shared dyno uniforms — created once, mutated per frame.
  const uniforms = useMemo(
    () => ({
      t: dyno.dynoFloat(0),
      visibility: dyno.dynoFloat(1),
      offset: dyno.dynoVec3(new THREE.Vector3()),
    }),
    [],
  );

  // The fade modifier has no per-transition inputs: build once.
  const fadeModifier = useMemo(
    () => createFadeModifier(uniforms.visibility),
    [uniforms],
  );

  const meshRef = useRef<SplatMesh | null>(null);
  const packedRef = useRef<Map<number, PackedSplats>>(new Map());

  /** Internal animation state (not reactive, driven by useFrame). */
  const state = useRef({
    displayedIndex: 0,
    targetIndex: 0,
    mode: "cross" as TransitionMode,
    progress: 0,
    animating: false,
  });

  const positionOf = (index: number) => {
    const p = positions?.[index];
    return p ? new THREE.Vector3(...p) : new THREE.Vector3();
  };

  // Load every environment's splats up-front and create the single mesh.
  useEffect(() => {
    let disposed = false;

    const spark = new SparkRenderer({
      renderer: gl,
      maxStdDev: Math.sqrt(5),
    });
    scene.add(spark);

    const mesh = new SplatMesh();
    mesh.visible = false;
    scene.add(mesh);
    meshRef.current = mesh;

    const packed = new Map<number, PackedSplats>();
    urls.forEach((url, i) => {
      if (!url) return;
      if (url.endsWith(".rad")) {
        console.error(
          `[LofiSplatScene] "${url}": .rad LoD files cannot be used with the ` +
            `lofi transition (LoD indices are camera-dependent and the array ` +
            `holds the LoD hierarchy). Re-export this environment as .spz ` +
            `with the same splat count as the others.`,
        );
      }

      const splats = new PackedSplats({ url });
      splats.initialized.then(() => {
        if (disposed) return;
        if (splats.numSplats === 0) {
          console.error(
            `[LofiSplatScene] "${url}" produced 0 renderable splats — ` +
              `LoD-only file? The environment will be invisible.`,
          );
        }
        // Show the initially-displayed environment as soon as it loads.
        const s = state.current;
        if (i === s.displayedIndex && !s.animating) {
          const p = positions?.[i];
          mesh.packedSplats = splats;
          if (p) mesh.position.set(...p);
          mesh.visible = true;
          mesh.updateGenerator();
        }
      });
      packed.set(i, splats);
    });
    packedRef.current = packed;

    return () => {
      disposed = true;
      scene.remove(mesh);
      scene.remove(spark);
      packed.forEach((splats) => splats.dispose());
      packedRef.current = new Map();
      meshRef.current = null;
    };
  }, [gl, scene, urls, positions]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = state.current;
    const target = environmentStore.activeIndex;

    // Detect a new transition request from the store.
    if (environmentStore.isTransitioning && !s.animating) {
      if (target === s.displayedIndex) {
        environmentStore.completeTransition();
      } else {
        const toSplats = urls[target] ? packedRef.current.get(target) : undefined;
        // Hold the transition until the incoming world finishes loading
        // (isTransitioning stays true, blocking further next() calls).
        if (toSplats && !toSplats.isInitialized) return;

        const fromHas = mesh.visible && (mesh.packedSplats?.numSplats ?? 0) > 0;
        const toHas = (toSplats?.numSplats ?? 0) > 0;

        s.targetIndex = target;
        s.progress = 0;

        if (fromHas && toHas) {
          // Full lofi transition: per-splat interpolation to the incoming
          // world, read on the GPU by index.
          s.mode = "cross";
          uniforms.t.value = 0;
          (uniforms.offset.value as THREE.Vector3)
            .copy(positionOf(target))
            .sub(positionOf(s.displayedIndex));
          mesh.objectModifier = createCrossModifier(
            toSplats!,
            uniforms.t,
            uniforms.offset,
          );
          mesh.updateGenerator();
          s.animating = true;
          longWhooshSound.current?.play();
        } else if (toHas) {
          // No outgoing splat (e.g. leaving "Default"): grow the world in.
          s.mode = "in";
          uniforms.visibility.value = 0;
          mesh.packedSplats = toSplats!;
          mesh.position.copy(positionOf(target));
          mesh.visible = true;
          mesh.objectModifier = fadeModifier;
          mesh.updateGenerator();
          s.animating = true;
          shortWhooshSound.current?.play();
        } else if (fromHas) {
          // No incoming splat: shrink the world away.
          s.mode = "out";
          uniforms.visibility.value = 1;
          mesh.objectModifier = fadeModifier;
          mesh.updateGenerator();
          s.animating = true;
          shortWhooshSound.current?.play();
        } else {
          // Neither side has splats — nothing to animate.
          s.displayedIndex = target;
          environmentStore.completeTransition();
        }
      }
    }

    // Advance the transition.
    if (s.animating) {
      s.progress = Math.min(s.progress + delta / transitionDuration, 1.0);
      const eased = smoothstep01(s.progress);
      if (s.mode === "cross") {
        uniforms.t.value = eased;
      } else {
        uniforms.visibility.value = s.mode === "in" ? eased : 1 - eased;
      }
      // Splat centers move: Spark must regenerate + re-sort each frame.
      mesh.updateVersion();

      if (s.progress >= 1.0) {
        if (s.mode === "cross") {
          const toSplats = packedRef.current.get(s.targetIndex);
          if (toSplats) {
            mesh.packedSplats = toSplats;
            mesh.position.copy(positionOf(s.targetIndex));
          }
        } else if (s.mode === "out") {
          mesh.visible = false;
        }
        mesh.objectModifier = undefined;
        mesh.updateGenerator();
        s.animating = false;
        s.displayedIndex = s.targetIndex;
        environmentStore.completeTransition();
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
