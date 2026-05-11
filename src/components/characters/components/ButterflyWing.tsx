import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type Signal } from "@preact/signals-react";
import {
  ShaderMaterial,
  TextureLoader,
  Uniform,
  DoubleSide,
  Vector3,
  MathUtils,
} from "three";
import { useMemo, useRef } from "react";
import { animationStore } from "@/stores/animationStore";

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
          uWingArch: new Uniform(0),
          uColorBias: new Uniform(new Vector3(1, 1, 1)),
          uColorBiasStrength: new Uniform(0),
          uGradientZoom: new Uniform(1),
          uGradientOffset: new Uniform(0),
        },
        side: DoubleSide,
      }),
    [flapSpeed],
  );

  const phaseRef = useRef(0);

  // Internal lerped values for smooth transitions.
  const currentWingArch = useRef(animationStore.wingArch);
  const currentColorBiasR = useRef(animationStore.wingColorBiasR);
  const currentColorBiasG = useRef(animationStore.wingColorBiasG);
  const currentColorBiasB = useRef(animationStore.wingColorBiasB);
  const currentColorBiasStrength = useRef(animationStore.wingColorBiasStrength);
  const currentGradientZoom = useRef(animationStore.wingGradientZoom);
  const currentGradientOffset = useRef(animationStore.wingGradientOffset);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-animationStore.lerpSpeed * delta);

    phaseRef.current += delta * flapSpeed.value;
    material.uniforms.uPhase.value = phaseRef.current;
    material.uniforms.uFlapSpeed.value = flapSpeed.value;

    // Lerp wing parameters toward store targets.
    currentWingArch.current = MathUtils.lerp(
      currentWingArch.current,
      animationStore.wingArch,
      t,
    );
    currentColorBiasR.current = MathUtils.lerp(
      currentColorBiasR.current,
      animationStore.wingColorBiasR,
      t,
    );
    currentColorBiasG.current = MathUtils.lerp(
      currentColorBiasG.current,
      animationStore.wingColorBiasG,
      t,
    );
    currentColorBiasB.current = MathUtils.lerp(
      currentColorBiasB.current,
      animationStore.wingColorBiasB,
      t,
    );
    currentColorBiasStrength.current = MathUtils.lerp(
      currentColorBiasStrength.current,
      animationStore.wingColorBiasStrength,
      t,
    );
    currentGradientZoom.current = MathUtils.lerp(
      currentGradientZoom.current,
      animationStore.wingGradientZoom,
      t,
    );
    currentGradientOffset.current = MathUtils.lerp(
      currentGradientOffset.current,
      animationStore.wingGradientOffset,
      t,
    );

    material.uniforms.uWingArch.value = currentWingArch.current;
    (material.uniforms.uColorBias.value as Vector3).set(
      currentColorBiasR.current,
      currentColorBiasG.current,
      currentColorBiasB.current,
    );
    material.uniforms.uColorBiasStrength.value =
      currentColorBiasStrength.current;
    material.uniforms.uGradientZoom.value = currentGradientZoom.current;
    material.uniforms.uGradientOffset.value = currentGradientOffset.current;
  });

  return (
    <group {...props}>
      <mesh material={material}>
        <planeGeometry args={[2, 1.4, 2, 1]} />
      </mesh>
    </group>
  );
}
