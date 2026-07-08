import { PackedSplats, dyno } from "@sparkjsdev/spark";

/**
 * Dyno modifiers implementing the lofi-worlds splat transition
 * (https://github.com/sparkjsdev/spark examples/lofi): every splat of the
 * outgoing world interpolates — center, scales, rotation (slerp), color —
 * to the SAME-INDEX splat of the incoming world's PackedSplats, read on the
 * GPU via readPackedSplat. Index pairing is arbitrary spatially, which is
 * what produces the world-tears-into-confetti-and-reassembles look.
 *
 * Requirements inherited from the algorithm:
 *  - Both worlds must be flat (non-LoD) PackedSplats so index i addresses
 *    the same splat every frame. LoD sources (.rad files) route indices
 *    through a camera-dependent lodIndices lookup and store the LoD
 *    hierarchy in the array, so they cannot participate.
 *  - Worlds should have equal splat counts (the lofi demo ships all-500k
 *    files). Unpaired splats (index beyond the incoming world's count) read
 *    back as inactive and take the shrink-out fallback below instead of
 *    mixing with undefined data.
 */

/**
 * The cross-transition dyno: blend this splat toward its same-index partner
 * in the incoming world. `t` is expected pre-eased (0 → 1). `offset` shifts
 * the incoming world's centers, supporting differing environment positions
 * within a single mesh (object space; the mesh must be unrotated/unscaled).
 *
 * `slerp` and GSPLAT_FLAG_ACTIVE come from Spark's base splat defines,
 * present in every generator program.
 */
function createCrossDyno() {
  return new dyno.Dyno({
    inTypes: {
      gsplat: dyno.Gsplat,
      gsplatNext: dyno.Gsplat,
      t: "float",
      offset: "vec3",
    },
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        float t = ${inputs.t};

        if ((${inputs.gsplatNext}.flags & GSPLAT_FLAG_ACTIVE) != 0u) {
          vec3 nextCenter = ${inputs.gsplatNext}.center + ${inputs.offset};
          ${outputs.gsplat}.center = mix(${inputs.gsplat}.center, nextCenter, t);
          ${outputs.gsplat}.scales = mix(${inputs.gsplat}.scales, ${inputs.gsplatNext}.scales, t);
          ${outputs.gsplat}.quaternion = slerp(${inputs.gsplat}.quaternion, ${inputs.gsplatNext}.quaternion, t);
          ${outputs.gsplat}.rgba = mix(${inputs.gsplat}.rgba, ${inputs.gsplatNext}.rgba, t);
        } else {
          // No same-index partner in the incoming world (splat count
          // mismatch or invalid read): shrink out instead of mixing with
          // undefined data.
          ${outputs.gsplat}.scales *= (1.0 - t);
          ${outputs.gsplat}.rgba.a *= (1.0 - t);
        }
      `),
  });
}

/**
 * Builds the cross-transition modifier for one specific incoming world.
 * Assign to `mesh.objectModifier` + `mesh.updateGenerator()` at transition
 * start; clear both at the end after swapping `mesh.packedSplats`.
 *
 * Built per transition (like the lofi example) because the incoming
 * PackedSplats' texture uniform is baked into the graph.
 */
export function createCrossModifier(
  nextSplats: PackedSplats,
  t: ReturnType<typeof dyno.dynoFloat>,
  offset: ReturnType<typeof dyno.dynoVec3>,
) {
  const cross = createCrossDyno();
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const index = dyno.splitGsplat(gsplat!).outputs.index;
      const gsplatNext = dyno.readPackedSplat(nextSplats.dyno, index);
      return {
        gsplat: cross.apply({ gsplat: gsplat!, gsplatNext, t, offset }).gsplat,
      };
    },
  );
}

/**
 * Scale+alpha fade for transitions to/from environments with no splat
 * (e.g. the "Default" environment): visibility 1 → 0 shrinks the world
 * away, 0 → 1 grows it in. Reusable across transitions — bind a shared
 * `visibility` uniform once.
 */
function createFadeDyno() {
  return new dyno.Dyno({
    inTypes: { gsplat: dyno.Gsplat, visibility: "float" },
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) =>
      dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        ${outputs.gsplat}.scales *= ${inputs.visibility};
        ${outputs.gsplat}.rgba.a *= ${inputs.visibility};
      `),
  });
}

export function createFadeModifier(
  visibility: ReturnType<typeof dyno.dynoFloat>,
) {
  const fade = createFadeDyno();
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => ({
      gsplat: fade.apply({ gsplat: gsplat!, visibility }).gsplat,
    }),
  );
}
