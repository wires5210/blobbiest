export const pixiJsFragmentShader = `
precision mediump float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;

void main(void)
{
    vec4 color = texture2D(uSampler, vTextureCoord);
    gl_FragColor = color * vColor;
    if (vTextureCoord.x <= 0.0 || vTextureCoord.x >= 1.0 || vTextureCoord.y <= 0.0 || vTextureCoord.y >= 1.0) {
        gl_FragColor = vec4(0, 0, 0, 0);
    }
}
`

export const pixiJsVertexShader = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;
varying vec4 vColor;

void main(void)
{
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;

    vColor = vec4(1, 1, 1, 1);
}
`;

