import { useEffect, useMemo } from "react";
import { environmentStore } from "../stores/environmentStore";
import { Light, type EnvironmentProps } from "./Environment";
import { LofiSplatScene } from "./LofiSplatScene";
import { useSignals } from "@preact/signals-react/runtime";

interface EnvironmentLoaderProps {
  /** The set of environments to make available for cycling. */
  environments: EnvironmentProps[];
  /** Duration of the splat transition in seconds. Defaults to 2.5. */
  transitionDuration?: number;
}

/**
 * Loads an environment set into the store and renders all splats with
 * lofi-worlds-style transitions. Lights and background update immediately
 * to match the active environment while the splats animate between scenes.
 *
 * @param environments The set of environments to load.
 * @param transitionDuration Seconds for the splat transition (default 2.5).
 */
export function EnvironmentLoader({
  environments,
  transitionDuration,
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
      <LofiSplatScene
        urls={urls}
        positions={positions}
        transitionDuration={transitionDuration}
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
