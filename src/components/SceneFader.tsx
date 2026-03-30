import { useRef, useEffect } from "react";
import { useSpring, animated } from "@react-spring/three";
import { useFrame } from "@react-three/fiber";
import { BackSide, Group } from "three";
import { sceneStore } from "../stores/sceneStore";
import { effect } from "@preact/signals-react";

/**
 * A black sphere that surrounds the active camera and fades between opaque
 * and transparent based on the scene store's isVisible flag.
 *
 * When isVisible is false the sphere becomes fully opaque black, hiding the
 * scene. When isVisible is true the sphere gradually loses opacity, revealing
 * the scene beneath.
 *
 * The sphere tracks the active camera position each frame so it works for
 * both the default scene camera and the XR camera.
 */
export function SceneFader() {
  const groupRef = useRef<Group>(null);

  // Spring-driven opacity: 1 = fully opaque (scene hidden), 0 = transparent.
  const [{ opacity }, api] = useSpring(() => ({
    opacity: sceneStore.isVisible ? 0 : 1,
    config: { tension: 30, friction: 20 },
    onRest: () => {
      if (!sceneStore.isVisible && !sceneStore.odysseyStarted) {
        sceneStore.completeStart();
      }
    },
  }));

  // Subscribe to the deepsignal and imperatively update the spring.
  useEffect(() => {
    const dispose = effect(() => {
      const visible = sceneStore.isVisible;
      api.start({ opacity: visible ? 0 : 1 });
    });
    return dispose;
  }, [api]);

  // Follow the active camera each frame.
  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.position.copy(camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh renderOrder={9999}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <animated.meshBasicMaterial
          color="black"
          side={BackSide}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
