/**
 * Фигуры, собранные из скруглённых примитивов: человек и робот.
 *
 * Одно описание работает в двух видах:
 *   — как полноценная модель (меши-примитивы) для сплошной фигуры в AR;
 *   — как облако точек, если раздать примитивам области развёртки (u, v).
 *
 * Скруглённые формы важны: точками на гранях параллелепипедов силуэт не
 * читается, а капсулы и эллипсоиды дают узнаваемый объём даже редкой сеткой.
 */

export type Vec3 = [number, number, number];

interface BasePart {
  /** Ярус развёртки: детали одного яруса делят общий диапазон v */
  band: number;
  /** Доля в ярусе. По умолчанию — площадь поверхности */
  weight?: number;
}

export interface EllipsoidPart extends BasePart {
  kind: 'ellipsoid';
  c: Vec3;
  r: Vec3;
}

export interface CapsulePart extends BasePart {
  kind: 'capsule';
  a: Vec3;
  b: Vec3;
  r: number;
}

export type Part = EllipsoidPart | CapsulePart;

/** Часть с назначенным прямоугольником развёртки */
export interface AtlasPart {
  part: Part;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 * Площадь поверхности — она же вес по умолчанию
 * ------------------------------------------------------------------ */

function surfaceArea(part: Part): number {
  if (part.kind === 'ellipsoid') {
    // Приближение Кнуда Томсена: для наших пропорций ошибка меньше процента
    const p = 1.6075;
    const [a, b, c] = part.r;
    const sum =
      (Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3;
    return 4 * Math.PI * Math.pow(sum, 1 / p);
  }

  const length = Math.hypot(
    part.b[0] - part.a[0],
    part.b[1] - part.a[1],
    part.b[2] - part.a[2],
  );
  return TAU * part.r * length + 4 * Math.PI * part.r * part.r;
}

/* ------------------------------------------------------------------ *
 * Развёртка
 * ------------------------------------------------------------------ */

/**
 * Ярусы идут снизу вверх и получают диапазон v пропорционально своему весу,
 * а внутри яруса детали делят диапазон u. Порядок ярусов повторяет строение
 * фигуры, поэтому соседние на сфере частицы попадают на соседние детали —
 * фигура собирается, а не осыпается.
 */
export function buildAtlas(parts: Part[]): AtlasPart[] {
  const bands = new Map<number, Part[]>();

  for (const part of parts) {
    const list = bands.get(part.band);
    if (list) list.push(part);
    else bands.set(part.band, [part]);
  }

  const order = [...bands.keys()].sort((a, b) => a - b);
  const bandWeights = order.map((band) =>
    (bands.get(band) ?? []).reduce(
      (sum, part) => sum + (part.weight ?? surfaceArea(part)),
      0,
    ),
  );
  const total = bandWeights.reduce((sum, value) => sum + value, 0);

  const atlas: AtlasPart[] = [];
  let v = 0;

  order.forEach((band, index) => {
    const list = bands.get(band) ?? [];
    const height = bandWeights[index] / total;
    const v0 = v;
    const v1 = index === order.length - 1 ? 1 : v + height;
    v = v1;

    const weights = list.map((part) => part.weight ?? surfaceArea(part));
    const bandTotal = weights.reduce((sum, value) => sum + value, 0);

    let u = 0;
    list.forEach((part, partIndex) => {
      const width = weights[partIndex] / bandTotal;
      const u0 = u;
      const u1 = partIndex === list.length - 1 ? 1 : u + width;
      u = u1;
      atlas.push({ part, u0, u1, v0, v1 });
    });
  });

  return atlas;
}

/* ------------------------------------------------------------------ *
 * Точка на поверхности примитива
 * ------------------------------------------------------------------ */

function sampleEllipsoid(part: EllipsoidPart, s: number, t: number): Vec3 {
  // cos(широты) распределяем равномерно — точки ложатся без сгущения у полюсов
  const cosTheta = 1 - 2 * t;
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = s * TAU;

  return [
    part.c[0] + part.r[0] * sinTheta * Math.cos(phi),
    part.c[1] + part.r[1] * cosTheta,
    part.c[2] + part.r[2] * sinTheta * Math.sin(phi),
  ];
}

function sampleCapsule(part: CapsulePart, s: number, t: number): Vec3 {
  const dx = part.b[0] - part.a[0];
  const dy = part.b[1] - part.a[1];
  const dz = part.b[2] - part.a[2];
  const length = Math.hypot(dx, dy, dz) || 1e-6;

  const ax = dx / length;
  const ay = dy / length;
  const az = dz / length;

  // Ортонормированный базис поперёк оси
  const helper: Vec3 = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let e1x = helper[1] * az - helper[2] * ay;
  let e1y = helper[2] * ax - helper[0] * az;
  let e1z = helper[0] * ay - helper[1] * ax;
  const e1len = Math.hypot(e1x, e1y, e1z) || 1e-6;
  e1x /= e1len;
  e1y /= e1len;
  e1z /= e1len;

  const e2x = ay * e1z - az * e1y;
  const e2y = az * e1x - ax * e1z;
  const e2z = ax * e1y - ay * e1x;

  const phi = s * TAU;
  const ringX = e1x * Math.cos(phi) + e2x * Math.sin(phi);
  const ringY = e1y * Math.cos(phi) + e2y * Math.sin(phi);
  const ringZ = e1z * Math.cos(phi) + e2z * Math.sin(phi);

  // Доля развёртки, уходящая на две полусферы
  const capShare = (2 * part.r) / (length + 2 * part.r);
  const half = capShare / 2;

  if (t < half) {
    // Нижняя полусфера
    const alpha = (t / half) * (Math.PI / 2);
    const cos = Math.cos(alpha);
    const sin = Math.sin(alpha);
    return [
      part.a[0] + (-ax * cos + ringX * sin) * part.r,
      part.a[1] + (-ay * cos + ringY * sin) * part.r,
      part.a[2] + (-az * cos + ringZ * sin) * part.r,
    ];
  }

  if (t > 1 - half) {
    // Верхняя полусфера
    const alpha = (1 - (t - (1 - half)) / half) * (Math.PI / 2);
    const cos = Math.cos(alpha);
    const sin = Math.sin(alpha);
    return [
      part.b[0] + (ax * cos + ringX * sin) * part.r,
      part.b[1] + (ay * cos + ringY * sin) * part.r,
      part.b[2] + (az * cos + ringZ * sin) * part.r,
    ];
  }

  // Цилиндрическая часть
  const along = ((t - half) / (1 - capShare)) * length;
  return [
    part.a[0] + ax * along + ringX * part.r,
    part.a[1] + ay * along + ringY * part.r,
    part.a[2] + az * along + ringZ * part.r,
  ];
}

export function samplePart(part: Part, s: number, t: number): Vec3 {
  return part.kind === 'ellipsoid'
    ? sampleEllipsoid(part, s, t)
    : sampleCapsule(part, s, t);
}

/** Точка фигуры по координатам развёртки сферы */
export function sampleAtlas(atlas: AtlasPart[], u: number, v: number): Vec3 {
  let found = atlas[atlas.length - 1];

  for (const entry of atlas) {
    if (v >= entry.v0 && v < entry.v1 && u >= entry.u0 && u < entry.u1) {
      found = entry;
      break;
    }
  }

  const s = (u - found.u0) / (found.u1 - found.u0);
  const t = (v - found.v0) / (found.v1 - found.v0);

  return samplePart(found.part, Math.min(0.9999, s), Math.min(0.9999, t));
}

/* ------------------------------------------------------------------ *
 * Каркас фигуры
 * ------------------------------------------------------------------ */

function pushLoop(
  out: number[],
  center: Vec3,
  axisA: Vec3,
  axisB: Vec3,
  segments = 26,
) {
  let prev: Vec3 | null = null;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const point: Vec3 = [
      center[0] + axisA[0] * cos + axisB[0] * sin,
      center[1] + axisA[1] * cos + axisB[1] * sin,
      center[2] + axisA[2] * cos + axisB[2] * sin,
    ];
    if (prev) out.push(prev[0], prev[1], prev[2], point[0], point[1], point[2]);
    prev = point;
  }
}

/**
 * Рёбра фигуры отдельными линиями.
 *
 * Редкое облако точек передаёт объём, но теряет силуэт: на чёрном фоне робот
 * расплывается. Контурные сечения деталей возвращают ему форму, оставаясь при
 * этом частью того же технического языка, что и разметка AR.
 */
export function buildFigureWireframe(parts: Part[]): Float32Array {
  const out: number[] = [];

  for (const part of parts) {
    if (part.kind === 'ellipsoid') {
      const [rx, ry, rz] = part.r;
      pushLoop(out, part.c, [rx, 0, 0], [0, ry, 0]);
      pushLoop(out, part.c, [rx, 0, 0], [0, 0, rz]);
      pushLoop(out, part.c, [0, ry, 0], [0, 0, rz]);
      continue;
    }

    const dx = part.b[0] - part.a[0];
    const dy = part.b[1] - part.a[1];
    const dz = part.b[2] - part.a[2];
    const length = Math.hypot(dx, dy, dz) || 1e-6;
    const ax = dx / length;
    const ay = dy / length;
    const az = dz / length;

    const helper: Vec3 = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1x = helper[1] * az - helper[2] * ay;
    let e1y = helper[2] * ax - helper[0] * az;
    let e1z = helper[0] * ay - helper[1] * ax;
    const e1len = Math.hypot(e1x, e1y, e1z) || 1e-6;
    e1x /= e1len;
    e1y /= e1len;
    e1z /= e1len;

    const e2x = ay * e1z - az * e1y;
    const e2y = az * e1x - ax * e1z;
    const e2z = ax * e1y - ay * e1x;

    const a1: Vec3 = [e1x * part.r, e1y * part.r, e1z * part.r];
    const a2: Vec3 = [e2x * part.r, e2y * part.r, e2z * part.r];

    pushLoop(out, part.a, a1, a2, 16);
    pushLoop(out, part.b, a1, a2, 16);

    // Продольные рёбра по четырём сторонам ствола
    for (const [sa, sb] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ox = a1[0] * sa + a2[0] * sb;
      const oy = a1[1] * sa + a2[1] * sb;
      const oz = a1[2] * sa + a2[2] * sb;
      out.push(
        part.a[0] + ox, part.a[1] + oy, part.a[2] + oz,
        part.b[0] + ox, part.b[1] + oy, part.b[2] + oz,
      );
    }
  }

  return new Float32Array(out);
}

/* ------------------------------------------------------------------ *
 * Человек
 *
 * Стоит лицом к зрителю, правая рука вытянута вперёд-вбок ладонью вверх —
 * над ней в сценарии 04 парит модель дома. Начало координат в середине роста.
 * ------------------------------------------------------------------ */

export const HUMAN_PARTS: Part[] = [
  // 0 — стопы
  { kind: 'ellipsoid', c: [-0.21, -1.5, 0.07], r: [0.11, 0.09, 0.2], band: 0 },
  { kind: 'ellipsoid', c: [0.21, -1.5, 0.07], r: [0.11, 0.09, 0.2], band: 0 },
  // 1 — голени
  { kind: 'capsule', a: [-0.2, -1.4, 0], b: [-0.19, -0.66, 0], r: 0.1, band: 1 },
  { kind: 'capsule', a: [0.2, -1.4, 0], b: [0.19, -0.66, 0], r: 0.1, band: 1 },
  // 2 — бёдра
  { kind: 'capsule', a: [-0.19, -0.66, 0], b: [-0.16, 0.02, 0], r: 0.13, band: 2 },
  { kind: 'capsule', a: [0.19, -0.66, 0], b: [0.16, 0.02, 0], r: 0.13, band: 2 },
  // 3 — таз
  { kind: 'capsule', a: [-0.1, 0.06, 0], b: [0.1, 0.06, 0], r: 0.24, band: 3 },
  // 4 — корпус и руки
  { kind: 'capsule', a: [0, 0.28, 0], b: [0, 0.82, 0], r: 0.29, band: 4 },
  { kind: 'capsule', a: [-0.31, 0.8, 0], b: [-0.42, 0.28, 0.02], r: 0.1, band: 4 },
  { kind: 'capsule', a: [-0.42, 0.28, 0.02], b: [-0.45, -0.2, 0.06], r: 0.09, band: 4 },
  { kind: 'ellipsoid', c: [-0.46, -0.31, 0.07], r: [0.09, 0.11, 0.07], band: 4 },
  { kind: 'capsule', a: [0.31, 0.8, 0], b: [0.62, 0.55, 0.14], r: 0.1, band: 4 },
  { kind: 'capsule', a: [0.62, 0.55, 0.14], b: [0.88, 0.45, 0.38], r: 0.09, band: 4 },
  { kind: 'ellipsoid', c: [0.95, 0.46, 0.45], r: [0.13, 0.05, 0.13], band: 4 },
  // 5 — плечи и шея
  { kind: 'ellipsoid', c: [-0.31, 0.82, 0], r: [0.13, 0.13, 0.13], band: 5 },
  { kind: 'ellipsoid', c: [0.31, 0.82, 0], r: [0.13, 0.13, 0.13], band: 5 },
  { kind: 'capsule', a: [0, 0.92, 0], b: [0, 1.02, 0], r: 0.08, band: 5 },
  // 6 — голова
  { kind: 'ellipsoid', c: [0, 1.3, 0], r: [0.25, 0.29, 0.25], band: 6 },
];

/** Где у человека центр раскрытой ладони — над ней парит дом */
export const HUMAN_PALM: Vec3 = [0.95, 0.46, 0.45];

/* ------------------------------------------------------------------ *
 * Робот
 *
 * Круглая голова с экраном вместо лица, скруглённый корпус, поднятая в
 * приветствии правая рука. Начало координат в середине роста.
 * ------------------------------------------------------------------ */

export const ROBOT_PARTS: Part[] = [
  // 0 — стопы
  { kind: 'ellipsoid', c: [-0.3, -1.06, 0.06], r: [0.21, 0.13, 0.28], band: 0 },
  { kind: 'ellipsoid', c: [0.3, -1.06, 0.06], r: [0.21, 0.13, 0.28], band: 0 },
  // 1 — ноги
  { kind: 'capsule', a: [-0.29, -0.94, 0], b: [-0.26, -0.28, 0], r: 0.15, band: 1 },
  { kind: 'capsule', a: [0.29, -0.94, 0], b: [0.26, -0.28, 0], r: 0.15, band: 1 },
  // 2 — корпус
  { kind: 'ellipsoid', c: [0, 0.2, 0], r: [0.47, 0.52, 0.4], band: 2 },
  // 3 — руки: левая опущена, правая поднята в приветствии
  { kind: 'ellipsoid', c: [-0.54, 0.42, 0], r: [0.17, 0.17, 0.17], band: 3 },
  { kind: 'capsule', a: [-0.6, 0.34, 0], b: [-0.72, -0.06, 0.02], r: 0.11, band: 3 },
  { kind: 'capsule', a: [-0.72, -0.06, 0.02], b: [-0.74, -0.42, 0.04], r: 0.1, band: 3 },
  { kind: 'ellipsoid', c: [-0.75, -0.55, 0.05], r: [0.14, 0.15, 0.11], band: 3 },
  { kind: 'ellipsoid', c: [0.54, 0.42, 0], r: [0.17, 0.17, 0.17], band: 3 },
  { kind: 'capsule', a: [0.6, 0.48, 0], b: [0.86, 0.82, 0.02], r: 0.11, band: 3 },
  { kind: 'capsule', a: [0.86, 0.82, 0.02], b: [0.92, 1.24, 0.06], r: 0.1, band: 3 },
  { kind: 'ellipsoid', c: [0.94, 1.42, 0.07], r: [0.16, 0.18, 0.12], band: 3 },
  // 4 — шея
  { kind: 'capsule', a: [0, 0.7, 0], b: [0, 0.78, 0], r: 0.13, band: 4 },
  // 5 — голова и боковые модули
  { kind: 'ellipsoid', c: [0, 1.16, 0], r: [0.58, 0.5, 0.47], band: 5 },
  { kind: 'ellipsoid', c: [-0.6, 1.14, 0], r: [0.1, 0.16, 0.16], band: 5 },
  { kind: 'ellipsoid', c: [0.6, 1.14, 0], r: [0.1, 0.16, 0.16], band: 5 },
];

/** Центр экрана-лица робота */
export const ROBOT_FACE: Vec3 = [0, 1.18, 0.44];

export const HUMAN_ATLAS = buildAtlas(HUMAN_PARTS);
export const ROBOT_ATLAS = buildAtlas(ROBOT_PARTS);
