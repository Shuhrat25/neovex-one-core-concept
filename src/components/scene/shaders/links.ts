import { CORE_UNIFORMS_GLSL, NOISE_GLSL, SHAPE_GLSL } from './common';

/**
 * Связи используют ту же функцию corePosition(), что и частицы, поэтому концы
 * отрезков всегда сидят ровно на узлах — при любой форме и в любой момент морфа.
 */
export const LINK_VERTEX = /* glsl */ `
${CORE_UNIFORMS_GLSL}

/** Порог видимости связи: чем меньше, тем раньше она появляется */
attribute float aThreshold;
/** 0 — начало отрезка, 1 — конец. Нужно для бегущего импульса */
attribute float aEnd;
/** 1 — длинная хорда через объём, 0 — связь соседних узлов */
attribute float aLong;

varying float vThreshold;
varying float vEnd;
varying float vDepth;
varying float vLong;

${NOISE_GLSL}
${SHAPE_GLSL}

void main() {
  vec3 transformed = corePosition();

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vThreshold = aThreshold;
  vEnd = aEnd;
  vLong = aLong;
  vDepth = max(-mvPosition.z, 0.45);
}
`;

export const LINK_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uColorLink;
uniform vec3 uColorAccent;
uniform float uOpacity;
uniform float uLinkDensity;
uniform float uEnergy;
uniform float uTime;
uniform float uTransition;
uniform float uChord;

varying float vThreshold;
varying float vEnd;
varying float vDepth;
varying float vLong;

void main() {
  // Плотность связей — прямой параметр сцены: связь включается, когда
  // плотность дорастает до её порога. В состоянии AI сеть «зажигает»
  // все дополнительные соединения (сценарий 02)
  float visible = smoothstep(vThreshold - 0.06, vThreshold + 0.06, uLinkDensity);
  // Длинные хорды рисуют нейронную сеть, но в собранных формах
  // (объект, панели, робот) они забивают силуэт — гасим их по сценарию
  visible *= mix(1.0, uChord, vLong);
  if (visible <= 0.001) discard;

  // Импульс, бегущий вдоль отрезка от узла к узлу
  float travel = fract(vThreshold * 7.31 + uTime * (0.18 + uEnergy * 0.5));
  float pulse = smoothstep(0.35, 0.0, abs(vEnd - travel));

  vec3 color = mix(uColorLink, uColorAccent, pulse * 0.8);
  color += uColorAccent * uTransition * 0.25;

  float depthFade = clamp(1.0 - (vDepth - 9.0) / 12.0, 0.1, 1.0);
  float alpha = visible * uOpacity * depthFade * (0.35 + pulse * 0.75 + uEnergy * 0.2);

  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
