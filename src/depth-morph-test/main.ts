/**
 * Odyssey — Depth Splat Morph Test (isolated)
 *
 * Goal: prove the "reality coalesces from splats" ending sequence.
 * On trigger (pinch/click): sample XR depth → unproject to 3D points →
 * morph a gaussian splat toward those points while the dome fades out.
 *
 * XR Blocks owns the session/renderer/loop. No React, no R3F, no R3XR.
 * Depth sensing is enabled but occlusion is NOT — XR Blocks decouples them
 * natively, so no need to vendor/patch R3XR.
 *
 * Run:  vite serve  →  open /depth-morph-test.html?formFactor=desktop
 * The ?formFactor=desktop flag autostarts the XR Blocks simulator which
 * provides fake depth data for desktop testing.
 */

import * as THREE from "three";
import * as xb from "xrblocks";
import { SplatMesh, SparkRenderer } from "@sparkjsdev/spark";

// ── constants ────────────────────────────────────────────────────────────

const SPLAT_URL = "/splats/renaissanceWorkshop-lod.rad";
const DOME_RADIUS = 500;
const DOME_SEGMENTS = 128;

/** How many depth samples to unproject into 3D points. */
const DEPTH_SAMPLE_COUNT = 4096;
/** Grid resolution for depth sampling (NxN). */
const DEPTH_GRID_SIZE = 64; // 64×64 = 4096
/** Transition duration in seconds. */
const TRANSITION_DURATION = 3.0;
/** Splat scale during morph (small = tight points). */
const MORPH_SPLAT_SCALE = 0.02;

// ── helpers ─────────────────────────────────────────────────────────────

const _v3 = new THREE.Vector3();

/**
 * Sample the depth buffer at a regular grid, unproject each sample to a 3D
 * world-space point, and return the array of points.
 *
 * XR Blocks' Depth controller caches depth data per frame. We access it via
 * `xb.depth.depthData[0]` (left eye) which has `{ data, width, height,
 * rawValueToMeters }`. We can also use `xb.depth.getDepth(u, v)` for
 * normalized coordinates.
 *
 * The depth values are distances from the camera plane. To unproject, we
 * convert (u, v, depth) → a ray in camera space, then multiply by depth and
 * transform to world space using the camera's matrixWorld.
 */
function sampleDepthPoints(
  depth: xb.Depth,
  camera: THREE.PerspectiveCamera,
  out: THREE.Vector3[],
): number {
  const { width, height } = depth;
  if (!width || !height) return 0;

  const rawToMeters = depth.rawValueToMeters;
  const depthArray = depth.depthArray?.[0]; // left eye
  if (!depthArray) return 0;

  // ponytail: camera matrices are up-to-date because XR Blocks updates them
  // before calling our update(). We need camera.matrixWorld and projection.
  camera.updateMatrixWorld();
  const worldMatrix = camera.matrixWorld;
  const projMatrix = camera.projectionMatrixInverse;

  let count = 0;
  const gridSize = DEPTH_GRID_SIZE;
  // Sample on a regular grid in normalized [0,1] UV space.
  for (let iy = 0; iy < gridSize; iy++) {
    for (let ix = 0; ix < gridSize; ix++) {
      const u = (ix + 0.5) / gridSize;
      const v = (iy + 0.5) / gridSize;

      // NDC coordinates [-1, 1].
      const ndcX = u * 2 - 1;
      const ndcY = v * 2 - 1;

      // Get depth in meters. getDepth takes normalized (u, v) with origin
      // at top-left of the depth image.
      const rawDepth = depth.getDepth(u, v);
      const depthMeters = rawDepth * rawToMeters;

      // Skip invalid depth (0 = no surface hit).
      if (depthMeters <= 0 || depthMeters > 100) continue;

      // Unproject: NDC (ndcX, ndcY, -1) * depthMeters → camera space.
      // Then camera space → world space via camera.matrixWorld.
      // Standard unproject: ndc → clip → eye → world.
      _v3.set(ndcX, ndcY, -1).applyMatrix4(projMatrix); // → camera space ray dir
      _v3.normalize().multiplyScalar(depthMeters); // → camera space point
      _v3.applyMatrix4(worldMatrix); // → world space

      if (out[count]) out[count].copy(_v3);
      else out[count] = _v3.clone();
      count++;
    }
  }
  return count;
}

// ── main script ─────────────────────────────────────────────────────────

class DepthMorphTest extends xb.Script {
  private spark!: SparkRenderer;
  private splatMesh!: SplatMesh;
  private dome!: THREE.Mesh;
  private domeMaterial!: THREE.MeshBasicMaterial;

  /** Original splat positions (before morph). */
  private originalCenters: THREE.Vector3[] = [];
  /** Target 3D points from depth. */
  private depthPoints: THREE.Vector3[] = [];

  private morphState: "idle" | "morphing" | "done" = "idle";
  private morphProgress = 0;

  /** Info overlay element. */
  private infoEl = document.getElementById("info");

  init() {
    // Lights.
    this.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));

    // Spark renderer for gaussian splats.
    this.spark = new SparkRenderer({
      renderer: xb.core.renderer,
      maxStdDev: Math.sqrt(5),
      enableLod: true,
    });
    this.add(this.spark);

    // Load the splat.
    this.splatMesh = new SplatMesh({ url: SPLAT_URL });
    this.splatMesh.position.set(0, 0, 0);
    this.add(this.splatMesh);

    // Cache original splat centers once loaded.
    this.splatMesh.initialized.then(() => {
      this.splatMesh.forEachSplat((_i, center, _s, _q, _o, _c) => {
        this.originalCenters.push(center.clone());
      });
      this.setInfo(`splat loaded: ${this.originalCenters.length} splats\npinch/click to morph`);
    });

    // Dome (simpler than Odyssey's textured concrete dome — we just need
    // something that can fade out).
    this.domeMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      side: THREE.BackSide,
      transparent: true,
      opacity: 1,
    });
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(DOME_RADIUS, DOME_SEGMENTS, DOME_SEGMENTS, 0, Math.PI * 2, 0, Math.PI / 2),
      this.domeMaterial,
    );
    this.add(this.dome);

    // Pre-allocate depth point array.
    for (let i = 0; i < DEPTH_SAMPLE_COUNT; i++) {
      this.depthPoints.push(new THREE.Vector3());
    }

    this.setInfo("initializing…\nenter XR or simulator to begin");
  }

  onSimulatorStarted() {
    this.setInfo("simulator started\npinch/click to morph splat → depth points");
  }

  onXRSessionStarted() {
    // Request depth from XR Blocks.
    if (xb.depth) {
      xb.depth.resumeDepth(this);
    }
    this.setInfo("XR session started\npinch/click to morph splat → depth points");
  }

  onXRSessionEnded() {
    if (xb.depth) {
      xb.depth.pauseDepth(this);
    }
    this.morphState = "idle";
    this.morphProgress = 0;
  }

  /** Trigger: pinch (XR) or click (desktop simulator). */
  onSelectEnd() {
    if (this.morphState !== "idle") return;
    if (!xb.depth?.enabled) {
      this.setInfo("depth not available\nstart XR/simulator first");
      return;
    }
    if (this.originalCenters.length === 0) {
      this.setInfo("splat not loaded yet…");
      return;
    }

    // Sample depth → 3D points.
    const pointCount = sampleDepthPoints(xb.depth, xb.core.camera, this.depthPoints);
    if (pointCount === 0) {
      this.setInfo("no depth data\nmove around to populate depth");
      return;
    }

    this.morphState = "morphing";
    this.morphProgress = 0;
    this.setInfo(`morphing ${this.originalCenters.length} splats → ${pointCount} depth points…`);
  }

  update(_time: number, _frame?: XRFrame) {
    if (this.morphState !== "morphing") return;

    const dt = xb.getDeltaTime();
    this.morphProgress = Math.min(this.morphProgress + dt / TRANSITION_DURATION, 1.0);

    // Ease: smoothstep.
    const t = this.morphProgress * this.morphProgress * (3 - 2 * this.morphProgress);

    // Morph splat centers toward depth points.
    // ponytail: we map splat i → depth point (i % pointCount). Not a perfect
    // matching but visually fine for a morph effect. A proper matching would
    // use nearest-neighbor or KD-tree — add when visual quality demands it.
    const pointCount = this.depthPoints.filter((p) => p.lengthSq() > 0).length;
    if (pointCount === 0) return;

    const scales = new THREE.Vector3().setScalar(MORPH_SPLAT_SCALE);
    const quat = new THREE.Quaternion();
    const color = new THREE.Color(0.8, 0.85, 1.0);
    const opacity = 1.0;

    this.splatMesh.forEachSplat((i, center, _s, _q, _o, _c) => {
      if (i >= this.originalCenters.length) return;
      const orig = this.originalCenters[i];
      const target = this.depthPoints[i % pointCount];
      if (!target) return;

      // Lerp center.
      center.lerpVectors(orig, target, t);
      this.splatMesh.packedSplats!.setSplat(i, center, scales, quat, opacity, color);
    });

    // Tell spark to re-upload.
    this.splatMesh.packedSplats!.needsUpdate = true;
    this.splatMesh.updateVersion();

    // Fade dome.
    this.domeMaterial.opacity = 1.0 - t;

    if (this.morphProgress >= 1.0) {
      this.morphState = "done";
      this.setInfo("morph complete — reality assembled");
    }
  }

  private setInfo(text: string) {
    if (this.infoEl) this.infoEl.textContent = text;
  }
}

// ── bootstrap ───────────────────────────────────────────────────────────

const options = new xb.Options();
options.enableDepth();
// ponytail: occlusion is opt-in in XR Blocks — we simply don't enable it.
// options.depth.occlusion.enabled defaults to false. No R3XR vendoring needed.

// Enable simulator for desktop testing (also auto-starts with ?formFactor=desktop).
options.formFactor = "auto";

document.addEventListener("DOMContentLoaded", () => {
  xb.add(new DepthMorphTest());
  xb.init(options);
});
