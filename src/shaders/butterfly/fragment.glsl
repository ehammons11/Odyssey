varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform sampler2D uWingTexture;
uniform sampler2D uJewelGradient;
uniform sampler2D uJewelNoise;

void main()
{
    // Sample wing texture.
    vec4 wing = texture2D(uWingTexture, vUv);

    // Discard transparent pixels.
    if (wing.a < 0.1) discard;

    // Brightness determines white vs black regions.
    float brightness = (wing.r + wing.g + wing.b) / 3.0;

    // Flip normal for back faces.
    vec3 normal = gl_FrontFacing ? vNormal : -vNormal;

    // Jewel coloring from view angle and noise perturbation.
    vec3 jewelNoise = texture2D(uJewelNoise, vUv).rgb;
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float viewAngle = mod((dot(viewDirection, normalize(normal + jewelNoise)) + 1.0) * 4.0, 1.0);
    vec3 jewelColor = texture2D(uJewelGradient, vec2(viewAngle, 0.0)).rgb;

    // Black pixels stay black, white pixels get jewel coloring.
    vec3 color = mix(vec3(0.0), jewelColor, brightness);

    gl_FragColor = vec4(color, 1.0);
}
