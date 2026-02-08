import { useMemo, type ComponentProps } from "react";
import { type ColorRepresentation } from "three";
import { FaceEyeGroup } from "./FaceEyeGroup";
import { getIcosahedronFaces, type FaceData } from "./faceData";

interface IcosahedronCharacterProps extends ComponentProps<"group"> {
  color?: ColorRepresentation;
  size?: number;
}

/**
 * Icosahedron character with an eyeball on each of its 20 faces.
 *
 * @param color The color of the icosahedron. Defaults to "#2ecc71".
 * @param size The size (radius) of the icosahedron. Defaults to 1.
 */
export function IcosahedronCharacter({
  color = "#2ecc71",
  size = 1,
  ...props
}: IcosahedronCharacterProps) {
  const faces = useMemo(() => getIcosahedronFaces(size), [size]);

  const eyeScale = 0.12 * size;

  return (
    <group {...props}>
      {/* Icosahedron mesh. */}
      <mesh>
        <icosahedronGeometry args={[size]} />
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
