import {
  DoubleSide,
  MeshStandardMaterial,
  TextureLoader,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import { type ThreeElements } from "@react-three/fiber";

const loader = new TextureLoader();

const industrialAlbedoTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_albedo.png",
);
industrialAlbedoTexture.colorSpace = SRGBColorSpace;

const industrialRoughnessTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_roughness.png",
);
const industrialMetalnessTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_metallic.png",
);
const industrialNormalTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_normal-ogl.png",
);
const industrialAoTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_ao.png",
);
const industrialHeightTexture = loader.load(
  "./materials/industrial_wall/industrial-walls_height.png",
);

const industrialTextures = [
  industrialAlbedoTexture,
  industrialRoughnessTexture,
  industrialMetalnessTexture,
  industrialNormalTexture,
  industrialAoTexture,
  industrialHeightTexture,
];

industrialTextures.forEach((tex) => {
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(8, 5);
});

const industrialWallMaterial = new MeshStandardMaterial({
  map: industrialAlbedoTexture,
  roughnessMap: industrialRoughnessTexture,
  metalnessMap: industrialMetalnessTexture,
  normalMap: industrialNormalTexture,
  aoMap: industrialAoTexture,
  displacementMap: industrialHeightTexture,
  displacementScale: -10,
  side: DoubleSide,
});

/**
 * Dome component that loads the futuristic space dome GLTF model and renders it in the scene.
 */
export function Dome(props: ThreeElements["group"]) {
  return (
    <group {...props} dispose={null}>
      <mesh material={industrialWallMaterial}>
        <sphereGeometry
          args={[500, 512, 512, undefined, undefined, undefined, Math.PI / 2]}
        />
      </mesh>
      <mesh
        {...props}
        rotation={[-Math.PI / 2, 0, 0]}
        material={industrialWallMaterial}
      >
        <planeGeometry args={[2000, 2000]} />
      </mesh>
    </group>
  );
}
