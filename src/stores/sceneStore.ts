import { deepSignal } from "deepsignal";

/**
 * Reactive store for whole-scene state such as visibility transitions.
 *
 * @param isVisible Whether the scene is currently visible. When false the
 *   scene fader obscures the view; when true the fader is transparent.
 *
 * @method setIsVisible Update the scene visibility flag.
 */
export const sceneStore = deepSignal({
  isVisible: true,
  odysseyStarted: false,
  setIsVisible(visible: boolean) {
    sceneStore.isVisible = visible;
  },
  startOdyssey() {
    sceneStore.isVisible = false;
  },
  completeStart() {
    sceneStore.odysseyStarted = true;
    sceneStore.isVisible = true;
  },
});
