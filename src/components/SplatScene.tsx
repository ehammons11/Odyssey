import { SplatMesh, SparkRenderer } from "@sparkjsdev/spark";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

interface SplatSceneProps {
  url: string;
  position?: [number, number, number];
}

/**
 * Sets up the SparkRenderer and SplatMesh for rendering splat data.
 *
 * @param url The URL of the splat file to load.
 */
export function SplatScene({
  url,
  position = DEFAULT_POSITION,
}: SplatSceneProps) {
  const { gl, scene } = useThree();

  useEffect(() => {
    // Create SparkRenderer with the WebGL renderer.
    const spark = new SparkRenderer({ renderer: gl });
    spark.renderOrder = 999;
    scene.add(spark);

    // Create SplatMesh.
    const splat = new SplatMesh({ url });
    splat.position.set(...position);
    scene.add(splat);

    // Wait for splat to load.
    return () => {
      scene.remove(spark);
      scene.remove(splat);
    };
  }, [gl, scene, url, position]);

  return null;
}
