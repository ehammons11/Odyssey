import { deepSignal } from "deepsignal";

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
 * @method next Advance to the next environment (wraps around). Blocked during transitions.
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
    environmentStore.isTransitioning = true;
    environmentStore.activeIndex =
      (environmentStore.activeIndex + 1) % environmentStore.count;
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
