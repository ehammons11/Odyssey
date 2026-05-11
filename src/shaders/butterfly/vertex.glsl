varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uPhase;
uniform float uFlapSpeed;
uniform float uWingArch;

void main()
{
    vUv = uv;

    // Phase lag increases toward the bottom of the wing, scaled by flap speed.
    float phaseLag = (1.0 - uv.y) * 0.4 * clamp(uFlapSpeed / 6.0, 0.0, 1.0);

    // Oscillating flap angle with per-vertex phase offset, biased by wing arch.
    float angle = sin(uPhase - phaseLag) * 0.6 + uWingArch;

    // Fold both halves around the center hinge (x = 0).
    vec3 pos = position;
    pos.x = position.x * cos(angle);
    pos.z = abs(position.x) * sin(angle);

    // Compute rotated normal to match wing orientation.
    vec3 wingNormal = vec3(
        -sign(position.x) * sin(angle),
        0.0,
        cos(angle)
    );

    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vPosition = modelPosition.xyz;
    vNormal = (modelMatrix * vec4(wingNormal, 0.0)).xyz;

    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
