/**
 * Раздел 6 ТЗ — механика scroll-driven 3D.
 *
 * Прогресс скролла (0…1) переводится в состояние сцены. Ключевые кадры стоят
 * в ЦЕНТРАХ секций: в середине секции сцена «отстоялась» и текст читается,
 * а вся деформация происходит на стыках. Так пользователь не листает секции,
 * а проматывает один общий timeline.
 */

import { STAGE_COUNT } from './stages';

/** Индексы целевых форм основного объекта (см. lib/shapes.ts) */
export const SHAPE = {
  SPHERE: 0,
  HOUSE: 1,
  UI: 2,
  ROBOT: 3,
} as const;

export interface SceneKey {
  shape: number;
  /** Амплитуда шумовой деформации поверхности */
  deform: number;
  /** Активность: скорость частиц и плотность видимых связей */
  energy: number;
  /** Плотность нейронных связей 0…1 */
  links: number;
  /**
   * Видимость длинных хорд через объём. На сфере они и создают рисунок
   * нейронной сети, но в собранных формах только забивают силуэт.
   */
  chord: number;
  /** Разлёт частиц от центра */
  scale: number;
  /** Положение основного объекта в сцене */
  corePos: [number, number, number];
  /** Размер основного объекта: в AR дом умещается в ладони */
  coreScale: number;
  /** Множитель собственного вращения. Внутри дома оно почти останавливается */
  spin: number;
  /**
   * Насколько сильно форму разворачивает лицом к зрителю. У робота там лицо,
   * у дома — дверь; сфере и панелям разворачиваться незачем.
   */
  facing: number;
  camera: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  /** Слой AR-маркеров */
  ar: number;
  /** Слой абстрактных UI-панелей */
  ui: number;
  /** Механический слой робота */
  robot: number;
  /** Человек как сплошная модель (AR) */
  figureSolid: number;
  /** Человек, разобранный на точки (VR) */
  figurePoints: number;
  figurePos: [number, number, number];
  figureScale: number;
  /**
   * Множитель яркости точек и связей. Дом раскинут на куда большей площади,
   * чем сфера, поэтому при той же альфе выглядит вдвое реже — компенсируем.
   */
  coreAlpha: number;
  /** Сила свечения */
  bloom: number;
  /** Реакция объекта на курсор */
  pointer: number;
  /**
   * Полуразмеры того, что камера обязана удержать в кадре. Разводить
   * по осям обязательно: робот высокий и узкий, панели интерфейса —
   * наоборот. Единый радиус на вертикальном экране отодвигал бы камеру
   * втрое дальше, чем нужно. Ноль — ограничения нет (камера внутри).
   */
  frameX: number;
  frameY: number;
}

/** Человек стоит на полу дома, когда сцена уходит внутрь (сценарий 05) */
// Свободный участок пола: между столом, кроватью и диваном
const FIGURE_IN_HOUSE: [number, number, number] = [0.75, -0.78, -0.15];
const FIGURE_IN_HOUSE_SCALE = 0.58;

/** Дом парит над раскрытой ладонью (сценарий 04) */
const HOUSE_IN_HAND: [number, number, number] = [1.0, 0.98, 0.44];
const HOUSE_IN_HAND_SCALE = 0.2;

/**
 * Восемь ключей: семь состояний из ТЗ + возврат к исходной нейронной сфере
 * (раздел 5, 07 — ROBOTICS: «После этого сцена возвращается к исходной сфере»).
 */
export const SCENE_KEYS: SceneKey[] = [
  // 01 — HERO
  {
    shape: SHAPE.SPHERE,
    deform: 0.13,
    energy: 0.32,
    links: 0.5,
    chord: 1,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 1,
    facing: 0,
    camera: [0, 0, 5.4],
    lookAt: [0, 0, 0],
    fov: 45,
    ar: 0,
    ui: 0,
    robot: 0,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: [0, 0, 0],
    figureScale: 1,
    coreAlpha: 1,
    bloom: 1,
    pointer: 1,
    frameX: 1.95,
    frameY: 1.95,
  },
  // 02 — ARTIFICIAL INTELLIGENCE
  {
    shape: SHAPE.SPHERE,
    deform: 0.26,
    energy: 1,
    links: 1,
    chord: 1,
    scale: 1.06,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 1,
    facing: 0,
    camera: [0.35, 0.15, 4.6],
    lookAt: [0, 0, 0],
    fov: 46,
    ar: 0,
    ui: 0,
    robot: 0,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: [0, 0, 0],
    figureScale: 1,
    coreAlpha: 1,
    bloom: 1.35,
    pointer: 0.8,
    frameX: 2.1,
    frameY: 2.1,
  },
  // 03 — 3D: тот же дом, но целиком и с близкой камеры
  {
    shape: SHAPE.HOUSE,
    deform: 0.035,
    energy: 0.4,
    links: 0.45,
    chord: 0.05,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 1,
    facing: 0,
    camera: [2.9, 1.5, 4.6],
    lookAt: [0, 0.35, 0],
    fov: 46,
    ar: 0,
    ui: 0,
    robot: 0,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: [0, 0, 0],
    figureScale: 1,
    coreAlpha: 1.3,
    bloom: 0.95,
    pointer: 0.35,
    frameX: 3.55,
    frameY: 2.25,
  },
  // 04 — AUGMENTED REALITY: человек держит модель дома
  {
    shape: SHAPE.HOUSE,
    deform: 0.035,
    energy: 0.42,
    links: 0.4,
    chord: 0.05,
    scale: 1,
    corePos: HOUSE_IN_HAND,
    coreScale: HOUSE_IN_HAND_SCALE,
    spin: 0.12,
    facing: 1,
    camera: [-0.75, 0.4, 4.3],
    lookAt: [0.5, 0.02, 0],
    fov: 46,
    ar: 1,
    ui: 0,
    robot: 0,
    figureSolid: 1,
    figurePoints: 0,
    figurePos: [0, 0, 0],
    figureScale: 1,
    coreAlpha: 1.3,
    bloom: 1,
    pointer: 0.4,
    frameX: 1.6,
    frameY: 2.0,
  },
  // 05 — VIRTUAL REALITY: тот же дом, но камера и человек внутри него
  {
    shape: SHAPE.HOUSE,
    deform: 0.03,
    energy: 0.34,
    links: 0.4,
    chord: 0.05,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 0.05,
    facing: 1,
    camera: [-0.35, -0.32, 1.5],
    lookAt: [0.75, -0.72, -1.15],
    fov: 76,
    ar: 0.22,
    ui: 0,
    robot: 0,
    figureSolid: 0,
    figurePoints: 1,
    figurePos: FIGURE_IN_HOUSE,
    figureScale: FIGURE_IN_HOUSE_SCALE,
    coreAlpha: 1.55,
    bloom: 1.2,
    pointer: 0.3,
    frameX: 0,
    frameY: 0,
  },
  // 06 — SOFTWARE
  {
    shape: SHAPE.UI,
    deform: 0.03,
    energy: 0.45,
    links: 0.2,
    chord: 0.04,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 1,
    facing: 0,
    camera: [0, 0.1, 5.1],
    lookAt: [0, 0, 0],
    fov: 44,
    ar: 0,
    ui: 1,
    robot: 0,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: FIGURE_IN_HOUSE,
    figureScale: FIGURE_IN_HOUSE_SCALE,
    coreAlpha: 1,
    bloom: 0.85,
    pointer: 0.4,
    frameX: 3.05,
    frameY: 1.95,
  },
  // 07 — ROBOTICS
  {
    shape: SHAPE.ROBOT,
    deform: 0.03,
    energy: 0.36,
    links: 0.3,
    chord: 0.06,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 0.06,
    facing: 1,
    camera: [0.45, 0.35, 5.4],
    lookAt: [0, 0.22, 0],
    fov: 45,
    ar: 0,
    ui: 0,
    robot: 1,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: FIGURE_IN_HOUSE,
    figureScale: FIGURE_IN_HOUSE_SCALE,
    coreAlpha: 1.6,
    bloom: 0.95,
    pointer: 0.45,
    frameX: 1.3,
    frameY: 1.6,
  },
  // Возврат к исходной сфере
  {
    shape: SHAPE.SPHERE,
    deform: 0.13,
    energy: 0.34,
    links: 0.5,
    chord: 1,
    scale: 1,
    corePos: [0, 0, 0],
    coreScale: 1,
    spin: 1,
    facing: 0,
    camera: [0, 0, 5.4],
    lookAt: [0, 0, 0],
    fov: 45,
    ar: 0,
    ui: 0,
    robot: 0,
    figureSolid: 0,
    figurePoints: 0,
    figurePos: FIGURE_IN_HOUSE,
    figureScale: FIGURE_IN_HOUSE_SCALE,
    coreAlpha: 1,
    bloom: 1,
    pointer: 0.9,
    frameX: 1.95,
    frameY: 1.95,
  },
];

/** Позиции ключей по прогрессу: центры секций + финальный ключ на 1.0 */
const KEY_POSITIONS: number[] = [
  ...Array.from({ length: STAGE_COUNT }, (_, i) => (i + 0.5) / STAGE_COUNT),
  1,
];

export interface SceneSample {
  shapeA: number;
  shapeB: number;
  shapeMix: number;
  deform: number;
  energy: number;
  links: number;
  chord: number;
  scale: number;
  corePos: [number, number, number];
  coreScale: number;
  spin: number;
  facing: number;
  camera: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  ar: number;
  ui: number;
  robot: number;
  figureSolid: number;
  figurePoints: number;
  figurePos: [number, number, number];
  figureScale: number;
  coreAlpha: number;
  bloom: number;
  pointer: number;
  frameX: number;
  frameY: number;
  /** 0…1 — насколько сцена сейчас «в переходе»; питает glitch и RGB-сдвиг */
  transition: number;
}

const sample: SceneSample = {
  shapeA: 0,
  shapeB: 0,
  shapeMix: 0,
  deform: 0,
  energy: 0,
  links: 0,
  chord: 1,
  scale: 1,
  corePos: [0, 0, 0],
  coreScale: 1,
  spin: 1,
  facing: 0,
  camera: [0, 0, 5.4],
  lookAt: [0, 0, 0],
  fov: 45,
  ar: 0,
  ui: 0,
  robot: 0,
  figureSolid: 0,
  figurePoints: 0,
  figurePos: [0, 0, 0],
  figureScale: 1,
  coreAlpha: 1,
  bloom: 1,
  pointer: 1,
  frameX: 1.95,
  frameY: 1.95,
  transition: 0,
};

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTriple(
  out: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
}

/**
 * Возвращает состояние сцены для заданного прогресса.
 * Объект переиспользуется — вызывается каждый кадр, мусор не создаём.
 */
export function sampleTimeline(progress: number): SceneSample {
  const p = Math.min(1, Math.max(0, progress));

  // Ищем интервал между ключами
  let i = 0;
  while (i < KEY_POSITIONS.length - 2 && p > KEY_POSITIONS[i + 1]) i++;

  const start = KEY_POSITIONS[i];
  const end = KEY_POSITIONS[i + 1];
  const span = end - start;
  const local = span > 0 ? (p - start) / span : 0;
  const t = smootherstep(Math.min(1, Math.max(0, local)));

  const a = SCENE_KEYS[i];
  const b = SCENE_KEYS[i + 1];

  sample.shapeA = a.shape;
  sample.shapeB = b.shape;
  sample.shapeMix = a.shape === b.shape ? 0 : t;

  sample.deform = lerp(a.deform, b.deform, t);
  sample.energy = lerp(a.energy, b.energy, t);
  sample.links = lerp(a.links, b.links, t);
  sample.chord = lerp(a.chord, b.chord, t);
  sample.scale = lerp(a.scale, b.scale, t);
  sample.coreScale = lerp(a.coreScale, b.coreScale, t);
  sample.spin = lerp(a.spin, b.spin, t);
  sample.facing = lerp(a.facing, b.facing, t);
  sample.fov = lerp(a.fov, b.fov, t);
  sample.ar = lerp(a.ar, b.ar, t);
  sample.ui = lerp(a.ui, b.ui, t);
  sample.robot = lerp(a.robot, b.robot, t);
  sample.figureSolid = lerp(a.figureSolid, b.figureSolid, t);
  sample.figurePoints = lerp(a.figurePoints, b.figurePoints, t);
  sample.figureScale = lerp(a.figureScale, b.figureScale, t);
  sample.coreAlpha = lerp(a.coreAlpha, b.coreAlpha, t);
  sample.bloom = lerp(a.bloom, b.bloom, t);
  sample.pointer = lerp(a.pointer, b.pointer, t);

  // У VR-ключа полуразмеры нулевые: ограничение кадрирования плавно сходит
  // на нет, пока камера входит внутрь дома
  sample.frameX = lerp(a.frameX, b.frameX, t);
  sample.frameY = lerp(a.frameY, b.frameY, t);

  lerpTriple(sample.corePos, a.corePos, b.corePos, t);
  lerpTriple(sample.camera, a.camera, b.camera, t);
  lerpTriple(sample.lookAt, a.lookAt, b.lookAt, t);
  lerpTriple(sample.figurePos, a.figurePos, b.figurePos, t);

  // Колокол: максимум ровно на стыке секций, ноль в их центрах.
  const bell = 4 * t * (1 - t);
  const shapeChanges = a.shape !== b.shape;
  sample.transition = bell * (shapeChanges ? 1 : 0.45);

  return sample;
}

/** Прогресс, соответствующий центру секции — для клика по навигации */
export function progressForStage(stageIndex: number): number {
  return (stageIndex + 0.5) / STAGE_COUNT;
}
