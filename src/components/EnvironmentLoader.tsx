import { useEffect, useMemo } from "react";
import { environmentStore } from "../stores/environmentStore";
import { Light, type EnvironmentProps } from "./Environment";
import { MorphingSplatScene } from "./MorphingSplatScene";
import { useSignals } from "@preact/signals-react/runtime";

interface EnvironmentLoaderProps {
  /** The set of environments to make available for cycling. */
  environments: EnvironmentProps[];
  /** Duration of the morph transition in seconds. Defaults to 3. */
  transitionDuration?: number;
  /** Radius of the random scatter during the morph. Defaults to 5. */
  randomRadius?: number;
}

/**
 * Loads an environment set into the store and renders all splats with morph
 * transitions. Lights and background update immediately to match the active
 * environment while the splats animate between scenes.
 *
 * @param environments The set of environments to load.
 * @param transitionDuration Seconds for the morph transition (default 3).
 * @param randomRadius Scatter radius for the morph effect (default 5).
 */
export function EnvironmentLoader({
  environments,
  transitionDuration,
  randomRadius,
}: EnvironmentLoaderProps) {
  useSignals();

  const urls = useMemo(
    () => environments.map((environment) => environment.splatUrl),
    [environments],
  );

  const positions = useMemo(
    () => environments.map((environment) => environment.splatPosition),
    [environments],
  );

  // Sync the store's count whenever the environment set changes.
  useEffect(() => {
    environmentStore.setEnvironmentCount(environments.length);
  }, [environments]);

  const activeConfig = environments[environmentStore.activeIndex];

  if (!activeConfig) return null;

  return (
    <>
      <MorphingSplatScene
        urls={urls}
        positions={positions}
        transitionDuration={transitionDuration}
        randomRadius={randomRadius}
      />

      {activeConfig.lights.map((light, index) => (
        <Light key={`${activeConfig.name}-light-${index}`} {...light} />
      ))}

      {activeConfig.backgroundColor && (
        <color attach="background" args={[activeConfig.backgroundColor]} />
      )}
    </>
  );
}
