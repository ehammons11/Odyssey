import {
  DoubleSide,
  MeshStandardMaterial,
  TextureLoader,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import { type ThreeElements } from "@react-three/fiber";

const loader = new TextureLoader();

const concreteAlbedoTexture = loader.load(
  "./materials/concrete3/concrete3-albedo.png",
);
concreteAlbedoTexture.colorSpace = SRGBColorSpace;

const concreteRoughnessTexture = loader.load(
  "./materials/concrete3/concrete3-Roughness.png",
);
const concreteMetalnessTexture = loader.load(
  "./materials/concrete3/concrete3-Metallic.png",
);
const concreteNormalTexture = loader.load(
  "./materials/concrete3/concrete3-Normal-ogl.png",
);
const concreteAoTexture = loader.load("./materials/concrete3/concrete3-ao.png");
const concreteHeightTexture = loader.load(
  "./materials/concrete3/concrete3-Height.png",
);

const concreteTextures = [
  concreteAlbedoTexture,
  concreteRoughnessTexture,
  concreteMetalnessTexture,
  concreteNormalTexture,
  concreteAoTexture,
  concreteHeightTexture,
];

concreteTextures.forEach((tex) => {
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(20, 10);
});

const concreteWallMaterial = new MeshStandardMaterial({
  map: concreteAlbedoTexture,
  roughnessMap: concreteRoughnessTexture,
  metalnessMap: concreteMetalnessTexture,
  normalMap: concreteNormalTexture,
  aoMap: concreteAoTexture,
  displacementMap: concreteHeightTexture,
  displacementScale: -0.5,
  side: DoubleSide,
});

/**
 * Renders a large concrete dome.
 */
export function Dome(props: ThreeElements["group"]) {
  return (
    <group {...props} dispose={null}>
      <mesh material={concreteWallMaterial}>
        <sphereGeometry
          args={[500, 128, 128, undefined, undefined, undefined, Math.PI / 2]}
        />
      </mesh>
      <mesh
        {...props}
        rotation={[-Math.PI / 2, 0, 0]}
        material={concreteWallMaterial}
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>
    </group>
  );
}
