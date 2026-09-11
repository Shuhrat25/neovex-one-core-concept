/**
 * Нейронные связи.
 *
 * Пары соседей ищем один раз на исходной сфере через хеш-сетку (O(n) вместо
 * перебора всех пар) и дальше переиспользуем для всех форм: концы отрезков
 * привязаны к индексам частиц, поэтому связи морфятся вместе с объектом.
 *
 * Сеть строится из двух типов связей:
 *   — короткие, между соседними узлами: дают ощущение плотной ткани;
 *   — длинные хорды через объём: именно они читаются на референсе как
 *     пересекающиеся линии внутри сферы.
 */

import { mulberry32 } from './rng';

export interface LinkGraph {
  /** Пары индексов частиц: [a0, b0, a1, b1, …] */
  pairs: Uint32Array;
  /** 1 — длинная хорда, 0 — короткая связь соседей */
  long: Uint8Array;
  count: number;
}

interface Cell {
  items: number[];
}

export function buildLinks(
  positions: Float32Array,
  particleCount: number,
  maxLinks: number,
  radius = 0.19,
  seed = 1337,
): LinkGraph {
  const pairs = new Uint32Array(maxLinks * 2);
  const long = new Uint8Array(maxLinks);
  const used = new Set<number>();
  let written = 0;

  const random = mulberry32(seed);
  const longBudget = Math.floor(maxLinks * 0.22);
  const nearBudget = maxLinks - longBudget;

  const claim = (i: number, j: number, isLong: boolean): boolean => {
    if (i === j || written >= maxLinks) return false;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const key = a * particleCount + b;
    if (used.has(key)) return false;
    used.add(key);

    pairs[written * 2] = a;
    pairs[written * 2 + 1] = b;
    long[written] = isLong ? 1 : 0;
    written++;
    return true;
  };

  /* ---------------------------------------------------------------- *
   * Короткие связи: хеш-сетка по ячейкам размером с радиус поиска
   * ---------------------------------------------------------------- */

  const cellSize = radius;
  const grid = new Map<string, Cell>();

  for (let i = 0; i < particleCount; i++) {
    const key =
      Math.floor(positions[i * 3] / cellSize) +
      '|' +
      Math.floor(positions[i * 3 + 1] / cellSize) +
      '|' +
      Math.floor(positions[i * 3 + 2] / cellSize);

    let cell = grid.get(key);
    if (!cell) {
      cell = { items: [] };
      grid.set(key, cell);
    }
    cell.items.push(i);
  }

  // Обходим частицы с шагом, взаимно простым с их количеством, чтобы связи
  // не сгущались в одной области сферы
  const stride = Math.max(1, Math.floor(particleCount / 7) | 1);
  const radiusSq = radius * radius;

  for (let n = 0; n < particleCount && written < nearBudget; n++) {
    const i = (n * stride + seed) % particleCount;

    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const cz = Math.floor(z / cellSize);

    let perParticle = 0;

    for (let dx = -1; dx <= 1 && perParticle < 3; dx++) {
      for (let dy = -1; dy <= 1 && perParticle < 3; dy++) {
        for (let dz = -1; dz <= 1 && perParticle < 3; dz++) {
          const cell = grid.get(cx + dx + '|' + (cy + dy) + '|' + (cz + dz));
          if (!cell) continue;

          for (const j of cell.items) {
            if (j <= i) continue;

            const ddx = positions[j * 3] - x;
            const ddy = positions[j * 3 + 1] - y;
            const ddz = positions[j * 3 + 2] - z;
            if (ddx * ddx + ddy * ddy + ddz * ddz > radiusSq) continue;

            if (!claim(i, j, false)) continue;
            perParticle++;

            if (perParticle >= 3 || written >= nearBudget) break;
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Длинные хорды: случайные пары на заметном расстоянии друг от друга
   * ---------------------------------------------------------------- */

  const minLongSq = 1.1 * 1.1;
  // Ограничиваем число попыток: на плотной сфере пара может не найтись,
  // и цикл не должен превратиться в бесконечный
  const maxAttempts = longBudget * 40;

  for (let attempt = 0; attempt < maxAttempts && written < maxLinks; attempt++) {
    const i = Math.floor(random() * particleCount);
    const j = Math.floor(random() * particleCount);

    const ddx = positions[j * 3] - positions[i * 3];
    const ddy = positions[j * 3 + 1] - positions[i * 3 + 1];
    const ddz = positions[j * 3 + 2] - positions[i * 3 + 2];
    if (ddx * ddx + ddy * ddy + ddz * ddz < minLongSq) continue;

    claim(i, j, true);
  }

  return { pairs, long, count: written };
}
