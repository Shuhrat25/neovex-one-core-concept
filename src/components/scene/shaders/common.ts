/**
 * Общий GLSL-код для частиц и связей.
 *
 * Обе программы обязаны считать одну и ту же позицию вершины, иначе связи
 * оторвутся от узлов. Поэтому морфинг, шумовая деформация и реакция на курсор
 * живут здесь, а не дублируются в двух шейдерах.
 */

/** Градиентный шум: хеш по трём осям, тригонометрическая база, без текстур. */
export const NOISE_GLSL = /* glsl */ `
vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
          dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
      mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
          dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
          dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
      mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
          dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}
`;

/** Атрибуты и юниформы, общие для точек и линий. */
export const CORE_UNIFORMS_GLSL = /* glsl */ `
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute float aRandom;

uniform float uTime;
uniform float uShapeA;
uniform float uShapeB;
uniform float uMix;
uniform float uDeform;
uniform float uEnergy;
uniform float uScale;
uniform vec3 uPointerPos;
uniform float uPointerStrength;
uniform float uTransition;
`;

/**
 * Выбор целевой формы по индексу. Ветвление идёт по uniform-значению —
 * оно одинаково для всего draw call, так что расхождения варпов нет.
 */
export const SHAPE_GLSL = /* glsl */ `
vec3 shapeAt(float index) {
  if (index < 0.5) return position;
  if (index < 1.5) return aP1;
  if (index < 2.5) return aP2;
  return aP3;
}

vec3 corePosition() {
  vec3 target = mix(shapeAt(uShapeA), shapeAt(uShapeB), uMix);

  // На середине морфа частицы слегка расходятся — переход читается как
  // перестроение структуры, а не как подмена одной формы другой
  float burst = 4.0 * uMix * (1.0 - uMix);
  vec3 outward = normalize(target + vec3(0.0001));
  target += outward * burst * 0.34 * (0.35 + aRandom);

  // Живая поверхность: две октавы шума, медленная и мелкая
  float slow = gnoise(target * 1.15 + vec3(0.0, 0.0, uTime * 0.14));
  float fine = gnoise(target * 3.4 - vec3(uTime * 0.2, 0.0, 0.0));
  float amount = uDeform * (1.0 + uTransition * 1.6);
  vec3 displaced = target + outward * (slow * amount + fine * amount * 0.32);

  // Дрейф частиц: чем выше активность, тем заметнее движение внутри сети.
  //
  // Поле течения берётся от ПОЗИЦИИ, а не от случайного числа частицы. Иначе
  // соседние узлы разлетаются в разные стороны сильнее, чем расстояние между
  // ними, и сеть рассыпается ровно там, где она должна выглядеть плотнее всего
  // (сценарий 02 — рост активности).
  vec3 flowSeed = target * 2.0;
  vec3 flow = vec3(
    gnoise(flowSeed + vec3(uTime * 0.33, 0.0, 0.0)),
    gnoise(flowSeed + vec3(0.0, uTime * 0.29, 11.3)),
    gnoise(flowSeed + vec3(0.0, 0.0, uTime * 0.26 + 27.7))
  );
  displaced += flow * uEnergy * 0.14;

  // И совсем немного индивидуального дрожания — чтобы узлы не выглядели
  // жёстко склеенными между собой
  displaced += vec3(
    sin(uTime * 1.4 + aRandom * 24.0),
    cos(uTime * 1.2 + aRandom * 31.0),
    sin(uTime * 1.6 + aRandom * 17.0)
  ) * uEnergy * 0.012;

  displaced *= uScale;

  // Реакция на курсор (сценарий 01): узлы мягко расступаются перед указателем
  if (uPointerStrength > 0.001) {
    vec3 away = displaced - uPointerPos;
    float dist = length(away);
    displaced += normalize(away + vec3(0.0001)) *
      (uPointerStrength * 0.5 / (1.0 + dist * dist * 2.2));
  }

  return displaced;
}
`;
