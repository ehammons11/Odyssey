import { type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { type GLTF } from "three-stdlib";
import { Mesh, MeshStandardMaterial } from "three";

type GLTFResult = GLTF & {
  nodes: {
    Object_4: Mesh;
    Object_5: Mesh;
    Object_6: Mesh;
  };
  materials: {
    Eye_outside: MeshStandardMaterial;
    Eye_outline: MeshStandardMaterial;
    Eye_inside: MeshStandardMaterial;
  };
};

/**
 * Eyeball component that loads and displays a low-poly eyeball model.
 */
export function Eyeball(props: ThreeElements["group"]) {
  const { nodes, materials } = useGLTF("/eyeball.glb") as unknown as GLTFResult;
  return (
    <group {...props} dispose={null}>
      <group position={[0, 1, 0]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_4.geometry}
          material={materials.Eye_outside}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_5.geometry}
          material={materials.Eye_outline}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_6.geometry}
          material={materials.Eye_inside}
        />
      </group>
    </group>
  );
}

useGLTF.preload("/eyeball.glb");
