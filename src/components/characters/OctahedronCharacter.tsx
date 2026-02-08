import { useMemo, type ComponentProps } from "react";
import { type ColorRepresentation } from "three";
import { FaceEyeGroup } from "./FaceEyeGroup";
import { getOctahedronFaces, type FaceData } from "./faceData";

interface OctahedronCharacterProps extends ComponentProps<"group"> {
  color?: ColorRepresentation;
  size?: number;
}

/**
 * Octahedron character with an eyeball on each of its 8 faces.
 *
 * @param color The color of the octahedron. Defaults to "#9b59b6".
 * @param size The size (radius) of the octahedron. Defaults to 1.
 */
export function OctahedronCharacter({
  color = "#9b59b6",
  size = 1,
  ...props
}: OctahedronCharacterProps) {
  const faces = useMemo(() => getOctahedronFaces(size), [size]);

  const eyeScale = 0.15 * size;

  return (
    <group {...props}>
      {/* Octahedron mesh. */}
      <mesh>
        <octahedronGeometry args={[size]} />
        <meshStandardMaterial color={color} flatShading />
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
