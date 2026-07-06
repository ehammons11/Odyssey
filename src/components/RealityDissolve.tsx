import { SplatMesh } from "@sparkjsdev/spark";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dissolveStore } from "../stores/dissolveStore";
import {
  DepthSnapshotter,
  disableXRDepthOcclusion,
} from "../lib/realityDissolve/depthSnapshot";
import {
  DISSOLVE_MODE,
  createDissolveModifier,
  createDissolveUniforms,
} from "../lib/realityDissolve/dissolveModifier";

interface RealityDissolveProps {
  /** Seconds for the full progress 0 → 1 ramp. */
  duration?: number;
  /**
   * Phase 2 gate: show a head-locked quad visualizing the depth snapshot as
   * grayscale (meters / 5, invalid texels dark red). While idle the snapshot
   * re-captures every frame for a live preview; triggering the dissolve
   * freezes it.
   */
  debugDepth?: boolean;
  /**
   * Phase 3 gate: replace the dissolve with a trivial `y += 1.0 * progress`
   * displacement to prove the uniform → dyno → GPU path. In this mode no
   * depth capture or XR session is required, so it can be tested on desktop
   * by calling `dissolve.store.start()` in the devtools console.
   */
  debugDisplacement?: boolean;
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Orchestrates the "dissolve into reality" effect: disables THREE's built-in
 * XR depth occlusion (keeping the depth feature alive), snapshots one depth
 * frame at transition start, and drives a dyno modifier on every SplatMesh
 * in the scene so splats fly onto real-world surfaces and fade out,
 * revealing passthrough.
 *
 * Trigger via `dissolveStore.start()`. Requires an active `immersive-ar`
 * session with depth sensing — outside XR, `start()` waits until a session
 * provides depth (except in `debugDisplacement` mode).
 */
export function RealityDissolve({
  duration = 4.5,
  debugDepth = false,
  debugDisplacement = false,
}: RealityDissolveProps) {
  const { gl, scene, camera } = useThree();

  const snapshotter = useMemo(() => new DepthSnapshotter(), []);
  const uniforms = useMemo(() => createDissolveUniforms(), []);
  const modifier = useMemo(() => createDissolveModifier(uniforms), [uniforms]);

  const attachedMeshes = useRef<SplatMesh[]>([]);
  const loggedDepthAvailable = useRef(false);
  const savedBackground = useRef<THREE.Scene["background"]>(null);

  uniforms.mode.value = debugDisplacement
    ? DISSOLVE_MODE.debugDisplace
    : DISSOLVE_MODE.dissolve;

  const detachAll = () => {
    for (const mesh of attachedMeshes.current) {
      const remaining = mesh.worldModifiers?.filter((m) => m !== modifier);
      mesh.worldModifiers = remaining?.length ? remaining : undefined;
      mesh.updateGenerator();
    }
    attachedMeshes.current = [];
  };

  // Phase 1: no occlusion, but keep the depth feature + texture available.
  useEffect(() => {
    const restoreOcclusion = disableXRDepthOcclusion(gl);
    return () => {
      restoreOcclusion();
      snapshotter.dispose();
    };
  }, [gl, snapshotter]);

  // Dev-only console handle for gate testing without a controller:
  // `dissolve.store.start()` / `.reset()`, `dissolve.snapshotter.decodeMode`.
  // Works in desktop devtools and in Quest remote inspection
  // (chrome://inspect over adb, or edge://inspect).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.dissolve = { store: dissolveStore, snapshotter, uniforms };
    return () => {
      delete w.dissolve;
    };
  }, [snapshotter, uniforms]);

  // Session lifecycle: near/far restore (THREE overrides XR camera planes
  // from the depth module; Quest can report depthFar = Infinity, producing
  // NaN projection matrices after exit — three.js #29098), squeeze trigger,
  // and effect reset on exit.
  useEffect(() => {
    const xr = gl.xr;
    const persp = camera as THREE.PerspectiveCamera;
    let savedNear = persp.near;
    let savedFar = persp.far;

    const onSessionStart = () => {
      savedNear = persp.near;
      savedFar = persp.far;
      loggedDepthAvailable.current = false;
    };

    const onSessionEnd = () => {
      persp.near = savedNear;
      persp.far = Number.isFinite(savedFar) ? savedFar : 1000;
      persp.updateProjectionMatrix();
      if (persp.projectionMatrix.elements.some(Number.isNaN)) {
        persp.near = 0.1;
        persp.far = 1000;
        persp.updateProjectionMatrix();
      }
      // A dissolve frozen mid-flight makes no sense outside AR: rewind.
      uniforms.progress.value = 0;
      detachAll();
      if (savedBackground.current) {
        scene.background = savedBackground.current;
        savedBackground.current = null;
      }
      dissolveStore.reset();
    };

    xr.addEventListener("sessionstart", onSessionStart);
    xr.addEventListener("sessionend", onSessionEnd);
    return () => {
      xr.removeEventListener("sessionstart", onSessionStart);
      xr.removeEventListener("sessionend", onSessionEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera]);

  useFrame((_, delta) => {
    const presenting = gl.xr.isPresenting;

    // Phase 1 gate diagnostic: confirm the depth texture is reachable.
    if (presenting && !loggedDepthAvailable.current && gl.xr.getDepthTexture()) {
      loggedDepthAvailable.current = true;
      console.info("[RealityDissolve] XR depth texture available (occlusion disabled)");
    }

    switch (dissolveStore.status) {
      case "idle": {
        // dissolveStore.reset() was called mid/post-dissolve: undo the effect.
        if (attachedMeshes.current.length > 0) {
          uniforms.progress.value = 0;
          detachAll();
          if (savedBackground.current) {
            scene.background = savedBackground.current;
            savedBackground.current = null;
          }
        }
        // Phase 2 gate: live snapshot preview while idle.
        if (debugDepth && presenting) snapshotter.capture(gl);
        break;
      }

      case "pendingCapture": {
        // Phase 3 gate (debugDisplacement) needs no depth and no XR session:
        // the displacement is a pure uniform -> dyno -> GPU test, so it also
        // runs on desktop via dissolveStore.start().
        if (!debugDisplacement) {
          if (!presenting) break; // wait for an XR frame
          if (!snapshotter.capture(gl)) {
            console.warn("[RealityDissolve] depth capture failed; retrying next frame");
            break;
          }

          // Freeze the capture pose into the dyno uniforms.
          (uniforms.captureViewProj.value as THREE.Matrix4).copy(
            snapshotter.captureViewProj,
          );
          (uniforms.capturePos.value as THREE.Vector3).copy(snapshotter.capturePos);
          (uniforms.captureFwd.value as THREE.Vector3).copy(snapshotter.captureFwd);
          uniforms.depthSnap.value = snapshotter.texture!;

          // A texture background (skybox) still renders in alpha-blend AR
          // and would cover passthrough — drop it for the reveal. Invisible
          // pop: the splat environment / dome still encloses the user at
          // progress 0.
          if (scene.background && !savedBackground.current) {
            savedBackground.current = scene.background;
            scene.background = null;
          }

          console.info(
            `[RealityDissolve] snapshot captured (${snapshotter.renderTarget?.width}x${snapshotter.renderTarget?.height})`,
          );
        }

        uniforms.progress.value = 0;
        dissolveStore.progress = 0;

        // Attach the modifier to every splat mesh in the scene, chained
        // after any existing modifier (e.g. the environment morph).
        detachAll();
        scene.traverse((obj) => {
          if (obj instanceof SplatMesh) {
            obj.worldModifiers = [...(obj.worldModifiers ?? []), modifier];
            obj.updateGenerator();
            attachedMeshes.current.push(obj);
          }
        });

        if (attachedMeshes.current.length === 0) {
          console.warn(
            "[RealityDissolve] no SplatMesh in scene — is a splat environment active? (environment 0 'Default' has none)",
          );
        } else {
          console.info(
            `[RealityDissolve] ${debugDisplacement ? "debug-displacing" : "dissolving"} ${attachedMeshes.current.length} splat mesh(es)`,
          );
        }
        dissolveStore.status = "dissolving";
        break;
      }

      case "dissolving": {
        const next = Math.min(
          dissolveStore.progress + delta / duration,
          1.0,
        );
        dissolveStore.progress = next;
        uniforms.progress.value = easeInOutCubic(next);
        // Splat centers move: Spark must regenerate + re-sort each frame.
        for (const mesh of attachedMeshes.current) mesh.updateVersion();
        if (next >= 1.0) dissolveStore.status = "done";
        break;
      }

      case "done":
        break;
    }
  });

  return debugDepth ? <DepthDebugQuad snapshotter={snapshotter} /> : null;
}

const DEBUG_QUAD_FRAGMENT = /* glsl */ `
uniform sampler2D tDepth;
varying vec2 vUv;

void main() {
  float meters = texture2D(tDepth, vUv).r;
  if (meters <= 0.0) {
    gl_FragColor = vec4(0.25, 0.0, 0.0, 1.0); // invalid: dark red
  } else {
    float g = clamp(meters / 5.0, 0.0, 1.0);
    gl_FragColor = vec4(vec3(g), 1.0);
  }
}
`;

const DEBUG_QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Phase 2 gate: head-locked quad showing the depth snapshot as grayscale
 * meters / 5. Walls, floor, and hands must read as a plausible depth map
 * before building on the decoded values.
 */
const QUAD_OFFSET = new THREE.Matrix4().makeTranslation(0, -0.12, -0.7);

function DepthDebugQuad({ snapshotter }: { snapshotter: DepthSnapshotter }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DEBUG_QUAD_VERTEX,
        fragmentShader: DEBUG_QUAD_FRAGMENT,
        uniforms: { tDepth: { value: null } },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ gl, camera }) => {
    // The render target is created lazily on first capture.
    material.uniforms.tDepth.value = snapshotter.texture;

    // Head-lock by copying the active camera pose (XR camera while
    // presenting) rather than reparenting the camera into the scene graph.
    const mesh = meshRef.current;
    if (!mesh) return;
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    mesh.matrix.multiplyMatrices(activeCamera.matrixWorld, QUAD_OFFSET);
  });

  return (
    <mesh
      ref={meshRef}
      matrixAutoUpdate={false}
      frustumCulled={false}
      renderOrder={10000}
      material={material}
    >
      <planeGeometry args={[0.4, 0.36]} />
    </mesh>
  );
}
