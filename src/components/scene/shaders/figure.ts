/**
 * Вершинный шейдер точечной фигуры.
 *
 * Фигура не морфится между состояниями, поэтому ей не нужны пять целевых
 * атрибутов ядра — только собственное дрожание и разлёт на появлении.
 * Фрагментная часть общая с ядром: свечение узлов должно совпадать.
 */
export const FIGURE_VERTEX = /* glsl */ `
attribute float aRandom;
attribute float aSize;

uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
/** Разлёт точек: на появлении фигура собирается из облака */
uniform float uScatter;

varying float vPulse;
varying float vRandom;
varying float vDepth;

void main() {
  vec3 transformed = position;

  // Мелкое дрожание — фигура должна выглядеть живой, а не замороженной
  transformed += vec3(
    sin(uTime * 1.3 + aRandom * 30.0),
    cos(uTime * 1.1 + aRandom * 22.0),
    sin(uTime * 1.6 + aRandom * 17.0)
  ) * 0.012;

  transformed += normalize(position + vec3(0.0001)) * uScatter * (0.25 + aRandom);

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float viewDistance = max(-mvPosition.z, 0.45);
  float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + aRandom * 40.0);

  gl_PointSize =
    uSize * aSize * uPixelRatio * (0.75 + pulse * 0.5) * (5.5 / viewDistance);
  gl_PointSize = min(gl_PointSize, 26.0 * uPixelRatio);

  vPulse = pulse;
  vRandom = aRandom;
  vDepth = viewDistance;
}
`;
