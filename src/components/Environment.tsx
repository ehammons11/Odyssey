import { SplatScene } from "./SplatScene";
import type { ColorRepresentation } from "three";

export interface LightProps {
  type: "ambient" | "directional" | "point" | "spot";
  intensity?: number;
  color?: ColorRepresentation;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Renders a single light based on its config.
 *
 * @param type The type of light to render (ambient, directional, point, or spot).
 * @param intensity The intensity of the light. Defaults to 1.
 * @param color The color of the light. Defaults to "white".
 * @param position The position of the light in [x, y, z] format. Defaults to [0, 0, 0].
 * @param rotation The rotation of the light in [x, y, z] format (for directional and spot lights). Defaults to [0, 0, 0].
 */
export function Light({
  type,
  intensity = 1,
  color = "white",
  position = [0, 0, 0],
  rotation,
}: LightProps) {
  switch (type) {
    case "ambient":
      return <ambientLight intensity={intensity} color={color} />;
    case "directional":
      return (
        <directionalLight
          intensity={intensity}
          color={color}
          position={position}
          rotation={rotation}
        />
      );
    case "point":
      return (
        <pointLight
          intensity={intensity}
          color={color}
          position={position}
          rotation={rotation}
        />
      );
    case "spot":
      return (
        <spotLight
          intensity={intensity}
          color={color}
          position={position}
          rotation={rotation}
        />
      );
  }
}

export interface EnvironmentProps {
  name: string;
  splatUrl: string;
  splatPosition?: [number, number, number];
  lights: LightProps[];
  backgroundColor?: ColorRepresentation;
}

/**
 * Renders a gaussian splat scene with its associated lighting.
 *
 * @param name The name of the environment (used for debugging and keys).
 * @param splatUrl The URL of the splat file to load for this environment.
 * @param splatPosition The position to place the splat in [x, y, z] format. Defaults to [0, 0, 0].
 * @param lights An array of light configs to render in this environment.
 * @param backgroundColor The background color for this environment. Defaults to transparent.
 */
export function Environment({
  name,
  splatUrl,
  splatPosition,
  lights,
  backgroundColor,
}: EnvironmentProps) {
  return (
    <>
      <SplatScene url={splatUrl} position={splatPosition} />

      {lights.map((light, i) => (
        <Light key={`${name}-light-${i}`} {...light} />
      ))}

      {backgroundColor && (
        <color attach="background" args={[backgroundColor]} />
      )}
    </>
  );
}
