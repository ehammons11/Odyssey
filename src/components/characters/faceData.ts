import {
  Vector3,
  Euler,
  TetrahedronGeometry,
  BoxGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  DodecahedronGeometry,
  BufferGeometry,
} from "three";

export interface FaceData {
  position: Vector3;
  rotation: Euler;
}

/**
 * Extracts face centers and normals from a BufferGeometry.
 * Groups coplanar triangles into single faces (for quads, pentagons, etc.).
 *
 * @param geometry The BufferGeometry to extract faces from.
 * @returns An array of FaceData objects representing each face.
 */
function extractFacesFromGeometry(geometry: BufferGeometry): FaceData[] {
  const positions = geometry.getAttribute("position");
  const indices = geometry.getIndex();

  // Store faces as array for tolerance-based comparison.
  const faceGroups: { centers: Vector3[]; normal: Vector3 }[] = [];

  const getVertex = (index: number): Vector3 => {
    return new Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    );
  };

  // Finds an existing face group with a similar normal (within tolerance).
  const findMatchingGroup = (
    normal: Vector3,
  ): { centers: Vector3[]; normal: Vector3 } | null => {
    const tolerance = 0.1; // Angular tolerance for grouping.
    for (const group of faceGroups) {
      // Check if normals are nearly parallel (dot product close to 1).
      if (normal.dot(group.normal) > 1 - tolerance) {
        return group;
      }
    }
    return null;
  };

  // Process each triangle.
  const numTriangles = indices ? indices.count / 3 : positions.count / 3;

  for (let i = 0; i < numTriangles; i++) {
    let i0: number, i1: number, i2: number;

    if (indices) {
      i0 = indices.getX(i * 3);
      i1 = indices.getX(i * 3 + 1);
      i2 = indices.getX(i * 3 + 2);
    } else {
      i0 = i * 3;
      i1 = i * 3 + 1;
      i2 = i * 3 + 2;
    }

    const v0 = getVertex(i0);
    const v1 = getVertex(i1);
    const v2 = getVertex(i2);

    // Calculate face center (centroid of triangle).
    const center = new Vector3().add(v0).add(v1).add(v2).divideScalar(3);

    // Calculate face normal.
    const edge1 = new Vector3().subVectors(v1, v0);
    const edge2 = new Vector3().subVectors(v2, v0);
    const normal = new Vector3().crossVectors(edge1, edge2).normalize();

    // Ensure normal points outward (away from origin).
    if (normal.dot(center) < 0) {
      normal.negate();
    }

    // Find existing group or create new one.
    const existingGroup = findMatchingGroup(normal);
    if (existingGroup) {
      existingGroup.centers.push(center);
    } else {
      faceGroups.push({ centers: [center], normal: normal.clone() });
    }
  }

  // Convert to FaceData array, averaging centers for multi-triangle faces.
  const faces: FaceData[] = [];
  faceGroups.forEach(({ centers, normal }) => {
    // Average all triangle centers to get face center.
    const faceCenter = new Vector3();
    centers.forEach((c) => faceCenter.add(c));
    faceCenter.divideScalar(centers.length);

    const rotation = getRotationFromNormal(normal);
    faces.push({ position: faceCenter, rotation });
  });

  return faces;
}

/**
 * Calculates Euler rotation to orient from default forward (0, 0, 1) to target normal.
 *
 * @param normal The target normal vector to orient towards.
 * @returns An Euler rotation that aligns the Z-axis with the normal.
 */
function getRotationFromNormal(normal: Vector3): Euler {
  // Handle case where normal is parallel to Y axis.
  if (Math.abs(normal.y) > 0.999) {
    const angle = normal.y > 0 ? -Math.PI / 2 : Math.PI / 2;
    return new Euler(angle, 0, 0);
  }

  // Calculate yaw (rotation around Y axis).
  const yaw = Math.atan2(normal.x, normal.z);

  // Calculate pitch (rotation around X axis).
  const pitch = -Math.asin(normal.y);

  return new Euler(pitch, yaw, 0, "YXZ");
}

/**
 * Generates face data for a tetrahedron (4 faces).
 *
 * @param radius The radius of the tetrahedron. Defaults to 1.
 * @returns An array of FaceData for each of the 4 faces.
 */
export function getTetrahedronFaces(radius: number = 1): FaceData[] {
  const geometry = new TetrahedronGeometry(radius);
  const faces = extractFacesFromGeometry(geometry);
  geometry.dispose();
  return faces;
}

/**
 * Generates face data for a cube (6 faces).
 *
 * @param size The size of the cube. Defaults to 1.
 * @returns An array of FaceData for each of the 6 faces.
 */
export function getCubeFaces(size: number = 1): FaceData[] {
  const geometry = new BoxGeometry(size, size, size);
  const faces = extractFacesFromGeometry(geometry);
  geometry.dispose();
  return faces;
}

/**
 * Generates face data for an octahedron (8 faces).
 *
 * @param radius The radius of the octahedron. Defaults to 1.
 * @returns An array of FaceData for each of the 8 faces.
 */
export function getOctahedronFaces(radius: number = 1): FaceData[] {
  const geometry = new OctahedronGeometry(radius);
  const faces = extractFacesFromGeometry(geometry);
  geometry.dispose();
  return faces;
}

/**
 * Generates face data for an icosahedron (20 faces).
 *
 * @param radius The radius of the icosahedron. Defaults to 1.
 * @returns An array of FaceData for each of the 20 faces.
 */
export function getIcosahedronFaces(radius: number = 1): FaceData[] {
  const geometry = new IcosahedronGeometry(radius);
  const faces = extractFacesFromGeometry(geometry);
  geometry.dispose();
  return faces;
}

/**
 * Generates face data for a dodecahedron (12 faces).
 *
 * @param radius The radius of the dodecahedron. Defaults to 1.
 * @returns An array of FaceData for each of the 12 faces.
 */
export function getDodecahedronFaces(radius: number = 1): FaceData[] {
  const geometry = new DodecahedronGeometry(radius);
  const faces = extractFacesFromGeometry(geometry);
  geometry.dispose();
  return faces;
}
