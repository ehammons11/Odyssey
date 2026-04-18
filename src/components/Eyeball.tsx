import { type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { type GLTF } from "three-stdlib";
import { Mesh, MeshStandardMaterial } from "three";

type GLTFResult = GLTF & {
  nodes: {
    Eye_Eye_0: Mesh;
    Eye_Iris_0: Mesh;
  };
  materials: {
    material: MeshStandardMaterial;
    Iris: MeshStandardMaterial;
  };
};

/**
 * Eyeball component that loads and displays a low-poly eyeball model.
 */
export function Eyeball(props: ThreeElements["group"]) {
  const { nodes, materials } = useGLTF(
    "/human_eye.glb",
  ) as unknown as GLTFResult;
  return (
    <group {...props} dispose={null}>
      <group rotation={[-1.807, 0, 0]}>
        <group rotation={[Math.PI / 1.8, 0, 0]} scale={0.01}>
          <group
            position={[0, 0, 16.654]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={100}
          >
            <mesh
              castShadow
              receiveShadow
              geometry={nodes.Eye_Eye_0.geometry}
              material={materials.material}
            />
            <mesh
              castShadow
              receiveShadow
              geometry={nodes.Eye_Iris_0.geometry}
              material={materials.Iris}
            />
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/eyeball.glb");
