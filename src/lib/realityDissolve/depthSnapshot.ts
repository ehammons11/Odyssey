import * as THREE from "three";

/**
 * Decode modes for the raw WebXR depth texture, selectable at runtime so the
 * Phase 2 gate (debug quad) can empirically pick the correct one for the
 * current Horizon Browser build without a rebuild.
 *
 * - `nonlinear`: value is normalized nonlinear depth in [0,1] between the
 *   session renderState depthNear/depthFar (matches what THREE's occlusion
 *   shader writes straight to gl_FragDepth). Expected on Quest gpu-optimized.
 * - `rawUnorm16`: value is a normalized uint16 sample; meters =
 *   sample * 65535 * rawValueToMeters.
 * - `rawFloat`: value is already meters-scaled; meters = sample * rawValueToMeters.
 */
export type DepthDecodeMode = "nonlinear" | "rawUnorm16" | "rawFloat";

const DECODE_MODE_INDEX: Record<DepthDecodeMode, number> = {
  nonlinear: 0,
  rawUnorm16: 1,
  rawFloat: 2,
};

/** Fallback snapshot resolution when the depth info reports no size (Quest is 320x288 per eye). */
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 288;

const BLIT_VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLIT_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uDepth;
uniform float uNear;
uniform float uFar;            // <= 0.0 encodes "infinite far"
uniform float uRawValueToMeters;
uniform int uDecodeMode;

in vec2 vUv;
out vec4 outColor;

void main() {
  float d = texture(uDepth, vec3(vUv, 0.0)).r; // layer 0 = left eye

  // d == 0.0 means "no depth data" per spec: propagate the 0.0 sentinel.
  float meters = 0.0;
  if (d > 0.0) {
    if (uDecodeMode == 1) {
      meters = d * 65535.0 * uRawValueToMeters;
    } else if (uDecodeMode == 2) {
      meters = d * uRawValueToMeters;
    } else if (uFar <= 0.0) {
      meters = uNear / (1.0 - d);
    } else {
      meters = uNear * uFar / (uFar - d * (uFar - uNear));
    }
  }

  outColor = vec4(meters, 0.0, 0.0, 1.0);
}
`;

/**
 * Captures a single WebXR depth frame (left eye) into an owned render target
 * holding linearized metric depth, together with the capture pose. All
 * dissolve math reads this frozen snapshot — never the live depth feed — so
 * targets stay world-stable while the head moves (see plan: SNAPSHOT, NOT
 * LIVE SAMPLING).
 *
 * `capture()` MUST be called synchronously inside an XR animation frame:
 * WebXR depth info is only valid within the frame it was obtained in.
 */
export class DepthSnapshotter {
  /** Linear metric depth (meters in .r), 0.0 = invalid/no data. */
  renderTarget: THREE.WebGLRenderTarget | null = null;
  /** Left-eye proj * view at capture time. */
  readonly captureViewProj = new THREE.Matrix4();
  /** Camera world position at capture time. */
  readonly capturePos = new THREE.Vector3();
  /** Camera world forward (normalized) at capture time. */
  readonly captureFwd = new THREE.Vector3(0, 0, -1);
  hasSnapshot = false;

  decodeMode: DepthDecodeMode = "nonlinear";

  private blitScene: THREE.Scene;
  private blitCamera: THREE.OrthographicCamera;
  private blitMaterial: THREE.RawShaderMaterial;
  /** Wraps the per-frame WebXR depth texture so THREE binds it as a 2D array. */
  private externalDepth = new THREE.ExternalTexture(null);

  constructor() {
    // ExternalTexture must be routed to setTexture2DArray; THREE picks the
    // binding point from the sampler type declared in the shader, so tagging
    // the texture itself is not required — but the uniform must stay typed
    // sampler2DArray in BLIT_FRAGMENT.
    this.blitMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BLIT_VERTEX,
      fragmentShader: BLIT_FRAGMENT,
      uniforms: {
        uDepth: { value: this.externalDepth },
        uNear: { value: 0.1 },
        uFar: { value: 0.0 },
        uRawValueToMeters: { value: 0.001 },
        uDecodeMode: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.blitScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMaterial);
    quad.frustumCulled = false;
    this.blitScene.add(quad);
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Blit the current XR depth frame into the snapshot target and record the
   * capture pose. Returns true on success. Safe to call every frame (used by
   * the Phase 2 debug quad for a live preview); the dissolve calls it once.
   */
  capture(renderer: THREE.WebGLRenderer): boolean {
    const xr = renderer.xr;
    if (!xr.isPresenting) return false;

    const session = xr.getSession();
    if (!session) return false;

    // Prefer the raw per-frame depth info: it carries the exact texture
    // handle, dimensions, and rawValueToMeters. THREE's cached
    // getDepthTexture() is the fallback (it wraps the first frame's handle,
    // which Meta's runtime keeps stable in practice).
    let sourceTexture: WebGLTexture | null = null;
    let width = DEFAULT_WIDTH;
    let height = DEFAULT_HEIGHT;
    let rawValueToMeters = 0.001;

    try {
      const frame = xr.getFrame();
      const refSpace = xr.getReferenceSpace();
      const viewerPose = refSpace ? frame?.getViewerPose(refSpace) : null;
      const view = viewerPose?.views[0];
      if (view) {
        const binding = xr.getBinding();
        const depthInfo = binding.getDepthInformation(view);
        if (depthInfo?.texture) {
          sourceTexture = depthInfo.texture;
          width = depthInfo.width || width;
          height = depthInfo.height || height;
          rawValueToMeters = depthInfo.rawValueToMeters ?? rawValueToMeters;
        }
      }
    } catch {
      // getDepthInformation throws outside an XR frame or when depth is
      // paused — fall through to the cached texture.
    }

    if (sourceTexture) {
      this.externalDepth.sourceTexture = sourceTexture;
    } else {
      const cached = xr.getDepthTexture() as THREE.ExternalTexture | null;
      if (!cached?.sourceTexture) return false;
      this.externalDepth.sourceTexture = cached.sourceTexture;
    }

    if (
      !this.renderTarget ||
      this.renderTarget.width !== width ||
      this.renderTarget.height !== height
    ) {
      this.renderTarget?.dispose();
      // Nearest filtering: interpolating meters across depth discontinuities
      // (or into 0.0-invalid texels) would land splats in midair.
      this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });
    }

    const renderState = session.renderState;
    const near = renderState.depthNear ?? 0.1;
    const far = renderState.depthFar;
    this.blitMaterial.uniforms.uNear.value = near;
    this.blitMaterial.uniforms.uFar.value = Number.isFinite(far) ? far : 0.0;
    this.blitMaterial.uniforms.uRawValueToMeters.value = rawValueToMeters;
    this.blitMaterial.uniforms.uDecodeMode.value = DECODE_MODE_INDEX[this.decodeMode];

    // Capture pose from the left XR eye camera (its matrices are current
    // inside the animation frame).
    const xrCamera = xr.getCamera();
    const leftEye = (xrCamera.cameras[0] ?? xrCamera) as THREE.PerspectiveCamera;
    this.captureViewProj.multiplyMatrices(
      leftEye.projectionMatrix,
      leftEye.matrixWorldInverse,
    );
    this.capturePos.setFromMatrixPosition(leftEye.matrixWorld);
    this.captureFwd.set(0, 0, -1).transformDirection(leftEye.matrixWorld).normalize();

    // Blit synchronously within this XR frame. xr.enabled must be off so the
    // render targets the RT with a plain camera instead of the XR layer.
    const prevTarget = renderer.getRenderTarget();
    const prevXrEnabled = xr.enabled;
    xr.enabled = false;
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.blitScene, this.blitCamera);
    renderer.setRenderTarget(prevTarget);
    xr.enabled = prevXrEnabled;

    this.hasSnapshot = true;
    return true;
  }

  get texture(): THREE.Texture | null {
    return this.renderTarget?.texture ?? null;
  }

  dispose() {
    this.renderTarget?.dispose();
    this.renderTarget = null;
    this.blitMaterial.dispose();
    this.hasSnapshot = false;
  }
}

/**
 * Phase 1: disable THREE's built-in depth occlusion while keeping the depth
 * feature (and getDepthTexture()) alive. WebGLRenderer.render injects a
 * fullscreen gl_FragDepth mesh via xr.getDepthSensingMesh() every presenting
 * frame; returning null skips it. Returns a restore function.
 */
export function disableXRDepthOcclusion(renderer: THREE.WebGLRenderer): () => void {
  const original = renderer.xr.getDepthSensingMesh;
  renderer.xr.getDepthSensingMesh = () => null;
  return () => {
    renderer.xr.getDepthSensingMesh = original;
  };
}
