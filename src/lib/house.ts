/**
 * Дом — общая форма для сценариев 04 (AR) и 05 (VR).
 *
 * В AR он маленький и парит над ладонью человека, в VR он же вырастает до
 * натуральной величины, и камера оказывается внутри. Это один и тот же объект
 * и одно и то же облако точек: переход между состояниями — это масштаб и
 * положение камеры, а не подмена модели.
 *
 * Чтобы «внутри» читалось как комната, дом собран не из голых стен: есть
 * дверь, окна, двускатная крыша и мебель на полу.
 */

import type { Vec3 } from './figures';

export const HOUSE = {
  /** Полуразмеры основания */
  hx: 2.15,
  hz: 2.15,
  floor: -1.7,
  wallTop: 0.45,
  /**
   * Конёк двускатной крыши. Скат специально крутой: в силуэте из точек
   * пологая крыша не читается, и дом выглядит просто коробкой.
   */
  ridge: 2.05,
  /** Свес крыши за стены */
  overhang: 1.09,
} as const;

/** Труба на скате — самый короткий способ сказать «это дом» */
export const CHIMNEY = {
  x0: 0.72,
  x1: 1.2,
  z0: -0.62,
  z1: -0.12,
  top: 2.45,
} as const;

/** Центр и полувысота коробки стен — по ним идёт проекция направления */
const BOX_CENTER_Y = (HOUSE.floor + HOUSE.wallTop) / 2;
const BOX_HALF_Y = (HOUSE.wallTop - HOUSE.floor) / 2;

/* ------------------------------------------------------------------ *
 * Проёмы
 * ------------------------------------------------------------------ */

type Face = 'x+' | 'x-' | 'z+' | 'z-';

export interface Opening {
  face: Face;
  /** Границы вдоль горизонтальной оси стены */
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

export const OPENINGS: Opening[] = [
  // Дверь на фасаде
  { face: 'z+', a0: -0.52, a1: 0.52, y0: HOUSE.floor, y1: HOUSE.floor + 1.55 },
  // Окна
  { face: 'x-', a0: -0.85, a1: 0.85, y0: HOUSE.floor + 0.95, y1: HOUSE.floor + 1.8 },
  { face: 'x+', a0: -0.85, a1: 0.85, y0: HOUSE.floor + 0.95, y1: HOUSE.floor + 1.8 },
  { face: 'z-', a0: -0.9, a1: 0.9, y0: HOUSE.floor + 0.95, y1: HOUSE.floor + 1.8 },
];

/* ------------------------------------------------------------------ *
 * Мебель
 * ------------------------------------------------------------------ */

interface Furniture {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Высота над полом */
  top: number;
  kind: 'block' | 'table';
}

export const FURNITURE: Furniture[] = [
  // Стол в центре комнаты
  { x0: -0.95, z0: -0.7, x1: 0.45, z1: 0.7, top: 0.72, kind: 'table' },
  // Кровать у дальней стены
  { x0: 0.85, z0: -1.95, x1: 1.95, z1: -0.4, top: 0.46, kind: 'block' },
  // Шкаф
  { x0: -1.95, z0: 0.6, x1: -1.35, z1: 1.9, top: 1.45, kind: 'block' },
  // Диван
  { x0: -0.5, z0: 1.2, x1: 1.15, z1: 1.95, top: 0.5, kind: 'block' },
];

/* ------------------------------------------------------------------ *
 * Отображение направления сферы в точку дома
 * ------------------------------------------------------------------ */

function mapFloor(px: number, pz: number, roll: number): Vec3 {
  for (const item of FURNITURE) {
    if (px < item.x0 || px > item.x1 || pz < item.z0 || pz > item.z1) continue;

    const u = (px - item.x0) / (item.x1 - item.x0);
    const v = (pz - item.z0) / (item.z1 - item.z0);

    if (item.kind === 'table') {
      const nearU = Math.min(u, 1 - u);
      const nearV = Math.min(v, 1 - v);

      // Углы отдаём ножкам, остальное — столешнице
      if (nearU < 0.2 && nearV < 0.2) {
        const legX = u < 0.5 ? item.x0 + 0.12 : item.x1 - 0.12;
        const legZ = v < 0.5 ? item.z0 + 0.12 : item.z1 - 0.12;
        const height = (nearU / 0.2) * item.top;
        return [legX, HOUSE.floor + height, legZ];
      }

      return [px, HOUSE.floor + item.top, pz];
    }

    // Объём: узкая полоса по краю становится боковой стенкой, центр — крышкой
    const rim = 0.16;
    const near = Math.min(u, 1 - u, v, 1 - v);

    if (near < rim) {
      const height = (near / rim) * item.top;
      const edgeX = u < 0.5 ? item.x0 : item.x1;
      const edgeZ = v < 0.5 ? item.z0 : item.z1;
      const onXEdge = Math.min(u, 1 - u) < Math.min(v, 1 - v);
      return [
        onXEdge ? edgeX : px,
        HOUSE.floor + height,
        onXEdge ? pz : edgeZ,
      ];
    }

    return [px, HOUSE.floor + item.top, pz];
  }

  // Свободный пол: половину точек разрежаем, чтобы читались доски
  const jitter = roll < 0.5 ? 0 : 0.02;
  return [px, HOUSE.floor + jitter, pz];
}

function mapRoof(px: number, pz: number): Vec3 {
  const rx = px * HOUSE.overhang;
  const rz = pz * HOUSE.overhang;
  const slope = 1 - Math.min(1, Math.abs(rx) / (HOUSE.hx * HOUSE.overhang));
  const roofY = HOUSE.wallTop + slope * (HOUSE.ridge - HOUSE.wallTop);

  const insideChimney =
    rx >= CHIMNEY.x0 && rx <= CHIMNEY.x1 && rz >= CHIMNEY.z0 && rz <= CHIMNEY.z1;

  if (insideChimney) {
    const u = (rx - CHIMNEY.x0) / (CHIMNEY.x1 - CHIMNEY.x0);
    const v = (rz - CHIMNEY.z0) / (CHIMNEY.z1 - CHIMNEY.z0);
    const near = Math.min(u, 1 - u, v, 1 - v);
    const rim = 0.3;

    if (near < rim) {
      // Боковые стенки трубы поднимаются от ската до верхнего среза
      const height = roofY + (near / rim) * (CHIMNEY.top - roofY);
      const onXEdge = Math.min(u, 1 - u) < Math.min(v, 1 - v);
      return [
        onXEdge ? (u < 0.5 ? CHIMNEY.x0 : CHIMNEY.x1) : rx,
        height,
        onXEdge ? rz : v < 0.5 ? CHIMNEY.z0 : CHIMNEY.z1,
      ];
    }

    return [rx, CHIMNEY.top, rz];
  }

  return [rx, roofY, rz];
}

function mapWall(px: number, py: number, pz: number, face: Face): Vec3 {
  let x = px;
  let y = py;
  let z = pz;

  // Торцевые стены достраиваются до линии крыши — иначе фронтон зияет дырой
  if (face === 'z+' || face === 'z-') {
    const slope = 1 - Math.min(1, Math.abs(px) / HOUSE.hx);
    const gableTop = HOUSE.wallTop + slope * (HOUSE.ridge - HOUSE.wallTop);
    const ratio = (py - HOUSE.floor) / (HOUSE.wallTop - HOUSE.floor);
    y = HOUSE.floor + ratio * (gableTop - HOUSE.floor);
  }

  // Точка внутри проёма уходит на его рамку: так появляются дверь и окна
  const along = face === 'x+' || face === 'x-' ? z : x;

  for (const opening of OPENINGS) {
    if (opening.face !== face) continue;
    if (along <= opening.a0 || along >= opening.a1) continue;
    if (y <= opening.y0 || y >= opening.y1) continue;

    const toA0 = along - opening.a0;
    const toA1 = opening.a1 - along;
    const toY0 = y - opening.y0;
    const toY1 = opening.y1 - y;
    const nearest = Math.min(toA0, toA1, toY0, toY1);

    let snappedAlong = along;
    let snappedY = y;

    if (nearest === toA0) snappedAlong = opening.a0;
    else if (nearest === toA1) snappedAlong = opening.a1;
    else if (nearest === toY0) snappedY = opening.y0;
    else snappedY = opening.y1;

    if (face === 'x+' || face === 'x-') z = snappedAlong;
    else x = snappedAlong;
    y = snappedY;
    break;
  }

  return [x, y, z];
}

/**
 * Точка дома для направления со сферы.
 *
 * Направление проецируется на коробку стен — это непрерывное отображение,
 * поэтому соседние частицы остаются соседями, и связи рисуют каркас дома,
 * а не паутину поперёк комнаты.
 */
export function mapHouse(dir: Vec3, roll: number): Vec3 {
  const ax = Math.abs(dir[0]) / HOUSE.hx;
  const ay = Math.abs(dir[1]) / BOX_HALF_Y;
  const az = Math.abs(dir[2]) / HOUSE.hz;
  const dominant = Math.max(ax, ay, az);

  if (dominant < 1e-6) return [0, HOUSE.floor, 0];

  const t = 1 / dominant;
  const px = dir[0] * t;
  const py = dir[1] * t + BOX_CENTER_Y;
  const pz = dir[2] * t;

  if (dominant === ay) {
    return dir[1] > 0 ? mapRoof(px, pz) : mapFloor(px, pz, roll);
  }

  const face: Face =
    dominant === ax ? (dir[0] > 0 ? 'x+' : 'x-') : dir[2] > 0 ? 'z+' : 'z-';

  return mapWall(px, py, pz, face);
}
