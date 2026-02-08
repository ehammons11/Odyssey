import { useMemo, type ComponentProps } from "react";
import { type ColorRepresentation } from "three";
import { FaceEyeGroup } from "./FaceEyeGroup";
import { getTetrahedronFaces, type FaceData } from "./faceData";

interface TetrahedronCharacterProps extends ComponentProps<"group"> {
  color?: ColorRepresentation;
  size?: number;
}

/**
 * Tetrahedron character with an eyeball on each of its 4 faces.
 *
 * @param color The color of the tetrahedron. Defaults to "#e74c3c".
 * @param size The size (radius) of the tetrahedron. Defaults to 1.
 */
export function TetrahedronCharacter({
  color = "#e74c3c",
  size = 1,
  ...props
}: TetrahedronCharacterProps) {
  const faces = useMemo(() => getTetrahedronFaces(size), [size]);

  const eyeScale = 0.15 * size;

  return (
    <group {...props}>
      {/* Tetrahedron mesh. */}
      <mesh>
        <tetrahedronGeometry args={[size]} />
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
