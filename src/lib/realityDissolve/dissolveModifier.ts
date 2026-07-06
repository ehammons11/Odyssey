import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

/**
 * Effect modes for the dissolve modifier. `debugDisplace` is the Phase 3
 * gate (trivial uniform-driven displacement proving the uniform → dyno → GPU
 * path); `dissolve` is the real Phase 4 effect.
 */
export const DISSOLVE_MODE = {
  debugDisplace: 0,
  dissolve: 1,
} as const;

/**
 * The uniform bundle shared by every splat mesh participating in the
 * dissolve. Create once via `createDissolveUniforms()`, mutate per frame /
 * per capture; the dyno program re-reads the values on every generator
 * update.
 */
export interface DissolveUniforms {
  /** 0 → 1 drives the whole effect. */
  progress: ReturnType<typeof dyno.dynoFloat>;
  /** Snapshot depth texture, linear meters in .r, 0 = invalid. */
  depthSnap: ReturnType<typeof dyno.dynoSampler2D>;
  /** Left-eye proj * view at capture time. */
  captureViewProj: ReturnType<typeof dyno.dynoMat4>;
  /** Camera world position at capture time. */
  capturePos: ReturnType<typeof dyno.dynoVec3>;
  /** Camera world forward at capture time. */
  captureFwd: ReturnType<typeof dyno.dynoVec3>;
  /** One of DISSOLVE_MODE. */
  mode: ReturnType<typeof dyno.dynoInt>;
}

/**
 * 1x1 black placeholder so the sampler uniform is always a valid texture
 * before the first capture. Reads as dMeters = 0 → fade-only path, which is
 * a no-op while progress = 0.
 */
function createPlaceholderTexture(): THREE.Texture {
  const tex = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  tex.needsUpdate = true;
  return tex;
}

export function createDissolveUniforms(): DissolveUniforms {
  return {
    progress: dyno.dynoFloat(0),
    depthSnap: dyno.dynoSampler2D(createPlaceholderTexture()),
    captureViewProj: dyno.dynoMat4(new THREE.Matrix4()),
    capturePos: dyno.dynoVec3(new THREE.Vector3()),
    captureFwd: dyno.dynoVec3(new THREE.Vector3(0, 0, -1)),
    mode: dyno.dynoInt(DISSOLVE_MODE.dissolve),
  };
}

/**
 * The dissolve dyno: each splat travels along the ray from the capture
 * camera through its own center until it lands on the real-world surface at
 * that pixel (frozen depth snapshot), shrinking, then fading. In an
 * alpha-blend AR session the alpha fade IS the passthrough reveal.
 *
 * Splats with no valid real-world target (outside the capture frustum,
 * invalid depth, or beyond Quest's ~5m range) take the fade-only path by
 * design.
 */
function createDissolveDyno() {
  return new dyno.Dyno({
    inTypes: {
      gsplat: dyno.Gsplat,
      progress: "float",
      depthSnap: "sampler2D",
      captureViewProj: "mat4",
      capturePos: "vec3",
      captureFwd: "vec3",
      mode: "int",
    },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [
      dyno.unindent(`
        float dissolveHash(float n) {
          return fract(sin(n * 12.9898) * 43758.5453);
        }
      `),
    ],
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        float progress = ${inputs.progress};

        if (${inputs.mode} == 0) {
          // Phase 3 gate: trivial displacement proving uniform -> GPU path.
          // 1m rise is unmissable at room scale.
          ${outputs.gsplat}.center.y += 1.0 * progress;
        } else {
          // Project the splat center through the frozen capture camera.
          vec4 clip = ${inputs.captureViewProj} * vec4(${inputs.gsplat}.center, 1.0);
          vec2 uv = (clip.xy / clip.w) * 0.5 + 0.5;

          // Feather the capture-frustum boundary: the fly-to-surface and
          // fade-only paths meet at the frustum edge, and a binary switch
          // draws a visible seam shaped like the capture viewport. Blend
          // between the two behaviors over the outermost 8% of the frustum.
          float inside = clip.w <= 0.0
            ? 0.0
            : smoothstep(
                0.0, 0.08,
                min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));

          float dMeters = inside <= 0.0
            ? 0.0
            : texture(${inputs.depthSnap}, clamp(uv, vec2(0.0), vec2(1.0))).r;

          float fadeAlpha = ${inputs.gsplat}.rgba.a * (1.0 - progress);

          if (dMeters <= 0.0) {
            // No real-world target for this splat: fade only.
            ${outputs.gsplat}.rgba.a = fadeAlpha;
          } else {
            vec3 ray = normalize(${inputs.gsplat}.center - ${inputs.capturePos});
            // viewZ -> distance along the ray (clamped to avoid blowup near
            // the frustum edge).
            float along = dMeters / max(dot(ray, ${inputs.captureFwd}), 0.05);
            // "landing", not "target": Spark's compute template declares a
            // global out variable named target.
            vec3 landing = ${inputs.capturePos} + ray * along;

            // Per-splat stagger, stable in g.index: Spark's sorter needs
            // frame-to-frame correspondence per index, and a monotonic lerp
            // keyed on index is safe.
            float h = dissolveHash(float(${inputs.gsplat}.index));
            float t = smoothstep(h * 0.5, h * 0.5 + 0.5, progress);

            ${outputs.gsplat}.center = mix(${inputs.gsplat}.center, landing, t * inside);
            ${outputs.gsplat}.scales *= mix(1.0, 0.15, t * inside);
            ${outputs.gsplat}.rgba.a = mix(
              fadeAlpha,
              ${inputs.gsplat}.rgba.a * (1.0 - t * t),
              inside);
          }
        }
      `),
  });
}

/**
 * Wraps the dissolve dyno into a `dynoBlock` assignable as a SplatMesh
 * world-space modifier (world space = XR space, the correct space for this
 * effect). Append it to `mesh.worldModifiers` to chain after an existing
 * modifier, then call `mesh.updateGenerator()`.
 */
export function createDissolveModifier(uniforms: DissolveUniforms) {
  const dissolve = createDissolveDyno();
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => ({
      gsplat: dissolve.apply({
        gsplat,
        progress: uniforms.progress,
        depthSnap: uniforms.depthSnap,
        captureViewProj: uniforms.captureViewProj,
        capturePos: uniforms.capturePos,
        captureFwd: uniforms.captureFwd,
        mode: uniforms.mode,
      }).gsplat,
    }),
  );
}
