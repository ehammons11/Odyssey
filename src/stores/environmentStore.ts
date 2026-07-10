import { deepSignal } from "deepsignal";
import { dissolveStore } from "./dissolveStore";

/**
 * Reactive store for tracking the active environment index.
 *
 * The store is decoupled from any specific environment set. Call
 * `setEnvironmentCount()` when an EnvironmentLoader mounts to configure
 * the upper bound.
 *
 * @param activeIndex Index of the currently active environment.
 * @param count Total number of environments in the loaded set.
 * @param isTransitioning Whether a morph transition is currently playing.
 *
 * @method setEnvironmentCount Configure the store for a new environment set. Resets the index to 0.
 *
 * @method next Advance to the next environment. Advancing past the LAST
 *   environment does not wrap: it starts the "dissolve into reality" ending
 *   instead (outside AR the dissolve arms and fires once an AR session with
 *   depth is available). Blocked during transitions.
 *
 * @method previous Go back to the previous environment (wraps around). Blocked during transitions.
 *
 * @method completeTransition Mark the current morph transition as finished.
 */
export const environmentStore = deepSignal({
  activeIndex: 0,
  count: 0,
  isTransitioning: false,
  setEnvironmentCount(count: number) {
    environmentStore.count = count;
    environmentStore.activeIndex = 0;
    environmentStore.isTransitioning = false;
  },
  next() {
    if (environmentStore.count === 0 || environmentStore.isTransitioning)
      return;
    // Past the final environment the odyssey ends: dissolve the splats into
    // reality instead of wrapping back to the first environment. This lives
    // here (not in individual triggers) so the agent tool, the desktop UI,
    // and any future trigger all end the same way.
    if (environmentStore.activeIndex === environmentStore.count - 1) {
      dissolveStore.start();
      return;
    }
    environmentStore.isTransitioning = true;
    environmentStore.activeIndex += 1;
  },
  previous() {
    if (environmentStore.count === 0 || environmentStore.isTransitioning)
      return;
    environmentStore.isTransitioning = true;
    environmentStore.activeIndex =
      (environmentStore.activeIndex - 1 + environmentStore.count) %
      environmentStore.count;
  },
  completeTransition() {
    environmentStore.isTransitioning = false;
  },
});
