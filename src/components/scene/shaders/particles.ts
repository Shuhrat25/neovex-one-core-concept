import { CORE_UNIFORMS_GLSL, NOISE_GLSL, SHAPE_GLSL } from './common';

export const PARTICLE_VERTEX = /* glsl */ `
${CORE_UNIFORMS_GLSL}

attribute float aSize;

uniform float uSize;
uniform float uPixelRatio;

varying float vPulse;
varying float vRandom;
varying float vDepth;

${NOISE_GLSL}
${SHAPE_GLSL}

void main() {
  vec3 transformed = corePosition();

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Пульсация узлов: у каждой частицы своя фаза, темп задаётся активностью
  float pulse = 0.5 + 0.5 * sin(uTime * (1.1 + uEnergy * 1.8) + aRandom * 40.0);

  // Внутри VR-среды камера почти касается частиц — ограничиваем знаменатель,
  // иначе точки раздуваются на весь экран
  float viewDistance = max(-mvPosition.z, 0.45);

  // 5.5 — эмпирический коэффициент перспективы: даёт узел около трёх пикселей
  // на исходной дистанции камеры
  gl_PointSize =
    uSize * aSize * uPixelRatio * (0.75 + pulse * 0.5) * (5.5 / viewDistance);
  gl_PointSize = min(gl_PointSize, 26.0 * uPixelRatio);

  vPulse = pulse;
  vRandom = aRandom;
  vDepth = viewDistance;
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uColorCore;
uniform vec3 uColorEdge;
uniform vec3 uColorAccent;
uniform float uOpacity;
uniform float uEnergy;
uniform float uTransition;
uniform float uTime;

varying float vPulse;
varying float vRandom;
varying float vDepth;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  // Мягкое ядро с ореолом — характер референса: светящаяся точка, не квадрат
  float falloff = smoothstep(0.5, 0.0, dist);
  float core = pow(falloff, 3.0);
  float halo = pow(falloff, 1.6) * 0.22;

  // Часть узлов вспыхивает акцентным цветом — прохождение импульса по сети
  float spark = step(0.94, fract(vRandom * 13.37 + uTime * 0.35));
  vec3 color = mix(uColorEdge, uColorCore, core);
  color = mix(color, uColorAccent, spark * 0.65 * uEnergy);
  color += uColorAccent * uTransition * 0.3;

  // Дальние частицы приглушаются, чтобы VR-среда читалась как глубина
  float depthFade = clamp(1.0 - (vDepth - 9.0) / 12.0, 0.15, 1.0);
  float alpha = (core + halo) * uOpacity * depthFade * (0.45 + vPulse * 0.55);

  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
