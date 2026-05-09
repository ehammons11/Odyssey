import { type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { type GLTF } from "three-stdlib";
import { Mesh, MeshStandardMaterial } from "three";

type GLTFResult = GLTF & {
  nodes: {
    Object_2: Mesh;
    Object_3: Mesh;
  };
  materials: {
    ["Material.001"]: MeshStandardMaterial;
    ["Material.002"]: MeshStandardMaterial;
  };
};

/**
 * Eyeball component that loads and displays a low-poly eyeball model.
 */
export function Eyeball(props: ThreeElements["group"]) {
  const { nodes, materials } = useGLTF("/eye.glb") as unknown as GLTFResult;
  return (
    <group {...props} dispose={null}>
      <group {...props} dispose={null}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2.geometry}
            material={materials["Material.001"]}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_3.geometry}
            material={materials["Material.002"]}
          />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/eye.glb");
