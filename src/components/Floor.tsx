import { useMemo } from "react";
import {
  Vector2,
  type Texture,
  RepeatWrapping,
  type MeshStandardMaterial,
} from "three";
import { useGLTF } from "@react-three/drei";
import { type GLTF } from "three-stdlib";
import { type ThreeElements } from "@react-three/fiber";

type GLTFResult = GLTF & {
  materials: {
    DomeTop_1001: MeshStandardMaterial;
    DomeDoor_1001: MeshStandardMaterial;
    Dome_1001: MeshStandardMaterial;
  };
};

/**
 * Simple floor component using a plane geometry and the Dome material from the GLTF.
 */
export function Floor(props: ThreeElements["mesh"]) {
  const { materials } = useGLTF(
    "/futuristic_space_dome.glb",
  ) as unknown as GLTFResult;

  const tiledMaterial = useMemo(() => {
    const mat = materials.Dome_1001.clone();
    const repeat = new Vector2(8, 5);

    const cloneTexture = (texture: Texture | null) => {
      if (!texture) return null;
      const cloned = texture.clone();
      cloned.wrapS = cloned.wrapT = RepeatWrapping;
      cloned.repeat.copy(repeat);
      cloned.needsUpdate = true;
      return cloned;
    };

    mat.map = cloneTexture(mat.map);
    mat.normalMap = cloneTexture(mat.normalMap);
    mat.roughnessMap = cloneTexture(mat.roughnessMap);
    mat.metalnessMap = cloneTexture(mat.metalnessMap);
    mat.aoMap = cloneTexture(mat.aoMap);

    return mat;
  }, [materials.Dome_1001]);

  return (
    <mesh {...props} rotation={[-Math.PI / 2, 0, 0]} material={tiledMaterial}>
      <planeGeometry args={[2000, 2000]} />
    </mesh>
  );
}
