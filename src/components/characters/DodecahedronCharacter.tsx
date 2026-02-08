import { useMemo, type ComponentProps } from "react";
import { type ColorRepresentation } from "three";
import { FaceEyeGroup } from "./FaceEyeGroup";
import { getDodecahedronFaces, type FaceData } from "./faceData";

interface DodecahedronCharacterProps extends ComponentProps<"group"> {
  color?: ColorRepresentation;
  size?: number;
}

/**
 * Dodecahedron character with an eyeball on each of its 12 faces.
 *
 * @param color The color of the dodecahedron. Defaults to "#f39c12".
 * @param size The size (radius) of the dodecahedron. Defaults to 1.
 */
export function DodecahedronCharacter({
  color = "#f39c12",
  size = 1,
  ...props
}: DodecahedronCharacterProps) {
  const faces = useMemo(() => getDodecahedronFaces(size), [size]);

  const eyeScale = 0.12 * size;

  return (
    <group {...props}>
      {/* Dodecahedron mesh. */}
      <mesh>
        <dodecahedronGeometry args={[size]} />
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
