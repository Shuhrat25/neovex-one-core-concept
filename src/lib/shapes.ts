/**
 * Целевые формы основного объекта.
 *
 * Ключевое требование: морфинг должен читаться как перестроение ОДНОЙ
 * структуры, а не как подмена одного облака точек другим. Поэтому все формы
 * строятся как непрерывные отображения исходной сферы: у частицы берётся её
 * направление (и развёртка u, v), и по нему считается позиция в каждой форме.
 *
 * Соседи на сфере остаются соседями во всех состояниях — значит нейронные
 * связи не превращаются в хаос линий, а силуэт новой формы читается сразу.
 *
 *   0 SPHERE — нейронная сфера (HERO / AI)
 *   1 HOUSE  — дом: целиком (3D), в руке (AR), вокруг камеры (VR)
 *   2 UI     — абстрактные интерфейсные панели (SOFTWARE)
 *   3 ROBOT  — робот из скруглённых деталей (ROBOTICS)
 */

import { ROBOT_ATLAS, sampleAtlas } from './figures';
import { mapHouse } from './house';
import { mulberry32 } from './rng';

export const SPHERE_RADIUS = 1.62;

export interface CoreShapes {
  count: number;
  /** Четыре Float32Array по count * 3 */
  positions: Float32Array[];
  /** Случайное число на частицу — фаза пульсации, разброс размеров */
  random: Float32Array;
  /** Базовый размер частицы */
  size: Float32Array;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* ------------------------------------------------------------------ *
 * 2 — Абстрактные UI-панели (SOFTWARE)
 * ------------------------------------------------------------------ */

export interface Panel {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** Наклон вокруг оси Y, радианы */
  ry: number;
  rows: number;
}

/**
 * Развёртка сферы 3×2: каждая ячейка (u, v) становится своей панелью.
 * Порядок важен — индекс равен row * 3 + col.
 */
export const UI_PANELS: Panel[] = [
  // Нижний ряд
  { x: -2.05, y: -0.92, z: -0.35, w: 1.55, h: 1.15, ry: 0.4, rows: 4 },
  { x: 0, y: -1.02, z: 0.3, w: 2.15, h: 0.95, ry: 0, rows: 3 },
  { x: 2.05, y: -0.92, z: -0.35, w: 1.55, h: 1.15, ry: -0.4, rows: 4 },
  // Верхний ряд
  { x: -2.05, y: 0.92, z: -0.35, w: 1.55, h: 1.5, ry: 0.4, rows: 6 },
  { x: 0, y: 0.95, z: 0.3, w: 2.15, h: 1.35, ry: 0, rows: 5 },
  { x: 2.05, y: 0.92, z: -0.35, w: 1.55, h: 1.5, ry: -0.4, rows: 6 },
];

const UI_COLS = 3;
const UI_ROWS = 2;

function mapUI(u: number, v: number, roll: number): number[] {
  const col = Math.min(UI_COLS - 1, Math.floor(u * UI_COLS));
  const row = Math.min(UI_ROWS - 1, Math.floor(v * UI_ROWS));
  const panel = UI_PANELS[row * UI_COLS + col];

  // Локальные координаты внутри ячейки развёртки
  const s = u * UI_COLS - col;
  const t = v * UI_ROWS - row;

  const halfW = panel.w / 2;
  const halfH = panel.h / 2;

  let localX: number;
  let localY: number;

  const margin = 0.09;
  const onBorder = s < margin || s > 1 - margin || t < margin || t > 1 - margin;

  if (onBorder) {
    // Края ячейки становятся контуром панели
    localX = (Math.min(1, Math.max(0, (s - margin) / (1 - 2 * margin))) - 0.5) * panel.w;
    localY = (Math.min(1, Math.max(0, (t - margin) / (1 - 2 * margin))) - 0.5) * panel.h;
    if (s < margin) localX = -halfW;
    if (s > 1 - margin) localX = halfW;
    if (t < margin) localY = -halfH;
    if (t > 1 - margin) localY = halfH;
  } else if (roll < 0.72) {
    // Внутренность собирается в строки контента разной длины
    const inner = (t - margin) / (1 - 2 * margin);
    const rowIndex = Math.min(panel.rows - 1, Math.floor(inner * panel.rows));
    const rowY = halfH - ((rowIndex + 1) / (panel.rows + 1)) * panel.h;
    const lineWidth = panel.w * (0.34 + ((rowIndex * 37) % 11) / 20);
    const along = (s - margin) / (1 - 2 * margin);
    localX = -halfW + panel.w * 0.07 + along * lineWidth;
    localY = rowY;
  } else {
    // Остальное — разрежённый фон панели
    localX = (s - 0.5) * panel.w * 0.92;
    localY = (t - 0.5) * panel.h * 0.92;
  }

  const cos = Math.cos(panel.ry);
  const sin = Math.sin(panel.ry);

  return [panel.x + localX * cos, panel.y + localY, panel.z - localX * sin];
}

/* ------------------------------------------------------------------ *
 * Сборка
 * ------------------------------------------------------------------ */

export function buildCoreShapes(count: number, seed = 20260909): CoreShapes {
  const random = mulberry32(seed);

  const sphere = new Float32Array(count * 3);
  const house = new Float32Array(count * 3);
  const ui = new Float32Array(count * 3);
  const robot = new Float32Array(count * 3);

  const randomAttr = new Float32Array(count);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Сфера Фибоначчи: равномерное покрытие без сгущений у полюсов.
    // Важно, что y распределён равномерно — значит развёртка (u, v)
    // тоже равномерна, и каждая панель получает одинаковую долю частиц.
    const dirY = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - dirY * dirY));
    const theta = GOLDEN_ANGLE * i;
    const dirX = Math.cos(theta) * ring;
    const dirZ = Math.sin(theta) * ring;
    const dir: [number, number, number] = [dirX, dirY, dirZ];

    const roll = random();
    const spread = random();
    const jitter = (random() - 0.5) * 0.03;

    // 0 — сфера. Небольшой разброс по радиусу делает сеть объёмной
    const shell = SPHERE_RADIUS * (0.9 + spread * 0.14);
    sphere[i * 3] = dirX * shell;
    sphere[i * 3 + 1] = dirY * shell;
    sphere[i * 3 + 2] = dirZ * shell;

    // Развёртка направления
    const u = Math.atan2(dirX, dirZ) / TAU + 0.5;
    const v = dirY * 0.5 + 0.5;

    const housePoint = mapHouse(dir, roll);
    house[i * 3] = housePoint[0];
    house[i * 3 + 1] = housePoint[1];
    house[i * 3 + 2] = housePoint[2];

    const uiPoint = mapUI(u, v, roll);
    ui[i * 3] = uiPoint[0];
    ui[i * 3 + 1] = uiPoint[1];
    ui[i * 3 + 2] = uiPoint[2] + jitter;

    const robotPoint = sampleAtlas(ROBOT_ATLAS, u, v);
    robot[i * 3] = robotPoint[0];
    robot[i * 3 + 1] = robotPoint[1];
    robot[i * 3 + 2] = robotPoint[2];

    randomAttr[i] = random();
    // Немного крупных узлов среди мелких частиц — как на референсе
    const sizeRoll = random();
    size[i] = sizeRoll > 0.985 ? 2.2 + random() * 0.9 : 0.5 + sizeRoll * 0.9;
  }

  return {
    count,
    positions: [sphere, house, ui, robot],
    random: randomAttr,
    size,
  };
}
