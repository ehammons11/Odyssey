import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type Signal } from "@preact/signals-react";
import { ShaderMaterial, TextureLoader, Uniform, DoubleSide } from "three";
import { useMemo, useRef } from "react";

import vertexShader from "@/shaders/butterfly/vertex.glsl?raw";
import fragmentShader from "@/shaders/butterfly/fragment.glsl?raw";

// Load textures at module scope.
const loader = new TextureLoader();
const wingTexture = loader.load("./butterfly.png");
const jewelGradient = loader.load("./materials/butterfly/color_gradient.png");
const jewelNoise = loader.load("./materials/butterfly/normal_noise.png");

type ButterflyWingProps = ThreeElements["group"] & {
  flapSpeed: Signal<number>;
};

/**
 * Renders a set of flapping butterfly wings using a custom shader.
 *
 * @param flapSpeed A signal controlling wing flapping speed.
 */
export function ButterflyWing({ flapSpeed, ...props }: ButterflyWingProps) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uPhase: new Uniform(0),
          uFlapSpeed: new Uniform(flapSpeed.peek()),
          uWingTexture: new Uniform(wingTexture),
          uJewelGradient: new Uniform(jewelGradient),
          uJewelNoise: new Uniform(jewelNoise),
        },
        side: DoubleSide,
      }),
    [flapSpeed],
  );

  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    phaseRef.current += delta * flapSpeed.value;
    material.uniforms.uPhase.value = phaseRef.current;
    material.uniforms.uFlapSpeed.value = flapSpeed.value;
  });

  return (
    <group {...props}>
      <mesh material={material}>
        <planeGeometry args={[2, 1.4, 2, 1]} />
      </mesh>
    </group>
  );
}
