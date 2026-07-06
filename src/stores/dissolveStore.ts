import { deepSignal } from "deepsignal";

/**
 * Reactive store driving the "dissolve into reality" ending sequence.
 *
 * Lifecycle: idle → pendingCapture (waiting for the next XR animation frame
 * to snapshot depth) → dissolving (progress animates 0 → 1) → done.
 *
 * @method start Begin the dissolve. The depth snapshot is captured on the
 *   next XR frame; no-op unless idle.
 * @method reset Return to idle and restore the splats (modifier stays
 *   attached but progress rewinds to 0).
 */
export const dissolveStore = deepSignal({
  status: "idle" as "idle" | "pendingCapture" | "dissolving" | "done",
  /** Eased effect progress in [0,1], mirrored from the GPU uniform. */
  progress: 0,
  start() {
    if (
      dissolveStore.status !== "idle" &&
      dissolveStore.status !== "done"
    )
      return;
    // Starting from "done" replays: the modifier is a pure function of
    // progress, so rewinding restores the original splats first.
    dissolveStore.progress = 0;
    dissolveStore.status = "pendingCapture";
  },
  reset() {
    dissolveStore.status = "idle";
    dissolveStore.progress = 0;
  },
});
