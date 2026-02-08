import { useMemo, type ComponentProps } from "react";
import { type ColorRepresentation } from "three";
import { FaceEyeGroup } from "./FaceEyeGroup";
import { getCubeFaces, type FaceData } from "./faceData";

interface CubeCharacterProps extends ComponentProps<"group"> {
  color?: ColorRepresentation;
  size?: number;
}

/**
 * Cube character with an eyeball on each of its 6 faces.
 *
 * @param color The color of the cube. Defaults to "#3498db".
 * @param size The size of the cube. Defaults to 1.
 */
export function CubeCharacter({
  color = "#3498db",
  size = 1,
  ...props
}: CubeCharacterProps) {
  const faces = useMemo(() => getCubeFaces(size), [size]);

  const eyeScale = 0.2 * size;

  return (
    <group {...props}>
      {/* Cube mesh. */}
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Eyes on each face. */}
      {faces.map((face: FaceData, index: number) => (
        <FaceEyeGroup
          key={index}
          position={face.position}
          rotation={face.rotation}
          eyeScale={eyeScale}
        />
      ))}
    </group>
  );
}
