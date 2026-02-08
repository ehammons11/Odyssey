import { SplatMesh, SparkRenderer } from "@sparkjsdev/spark";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface SplatSceneProps {
  url: string;
}

/**
 * Sets up the SparkRenderer and SplatMesh for rendering splat data.
 *
 * @param url The URL of the splat file to load.
 */
export function SplatScene({ url }: SplatSceneProps) {
  const { gl, scene } = useThree();

  useEffect(() => {
    // Create SparkRenderer with the WebGL renderer.
    const spark = new SparkRenderer({ renderer: gl });
    scene.add(spark);

    // Create SplatMesh.
    const splat = new SplatMesh({ url });
    splat.position.set(0, 0, 0);
    scene.add(splat);

    // Wait for splat to load.
    return () => {
      scene.remove(spark);
      scene.remove(splat);
    };
  }, [gl, scene, url]);

  return null;
}
