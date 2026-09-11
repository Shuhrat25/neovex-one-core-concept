'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { CHIMNEY, FURNITURE, HOUSE, OPENINGS } from '@/lib/house';
import { SHAPE } from '@/lib/timeline';
import { PALETTE } from './palette';

/**
 * Конструктив дома для сценариев 04 и 05.
 *
 * Облако точек задаёт поверхности, но изнутри комнаты они складываются в кашу:
 * ближняя и дальняя стены накладываются, пол теряется. Явные рёбра — периметр
 * пола, угловые стойки, конёк, скаты, коробки проёмов и мебели — возвращают
 * пространству план. Слой живёт внутри группы ядра и масштабируется вместе
 * с домом, поэтому в ладони это аккуратная модель, а внутри — та же комната.
 */

function pushSegment(points: number[], a: number[], b: number[]) {
  points.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** Прямоугольник в горизонтальной плоскости на высоте y */
function pushRect(
  points: number[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
) {
  pushSegment(points, [x0, y, z0], [x1, y, z0]);
  pushSegment(points, [x1, y, z0], [x1, y, z1]);
  pushSegment(points, [x1, y, z1], [x0, y, z1]);
  pushSegment(points, [x0, y, z1], [x0, y, z0]);
}

function buildStructure(): THREE.BufferGeometry {
  const p: number[] = [];
  const { hx, hz, floor, wallTop, ridge, overhang } = HOUSE;
  const ex = hx * overhang;
  const ez = hz * overhang;

  // Пол: периметр и разрежённая сетка досок
  pushRect(p, -hx, -hz, hx, hz, floor);
  const step = (hx * 2) / 6;
  for (let i = 1; i < 6; i++) {
    const v = -hx + step * i;
    pushSegment(p, [v, floor, -hz], [v, floor, hz]);
    pushSegment(p, [-hx, floor, v], [hx, floor, v]);
  }

  // Угловые стойки и линия карниза
  pushRect(p, -hx, -hz, hx, hz, wallTop);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    pushSegment(p, [sx * hx, floor, sz * hz], [sx * hx, wallTop, sz * hz]);
  }

  // Крыша: конёк, скаты и свес
  pushSegment(p, [0, ridge, -ez], [0, ridge, ez]);
  for (const sz of [-1, 1]) {
    // Фронтон
    pushSegment(p, [0, ridge, sz * hz], [-hx, wallTop, sz * hz]);
    pushSegment(p, [0, ridge, sz * hz], [hx, wallTop, sz * hz]);
    // Ребро свеса
    pushSegment(p, [0, ridge, sz * ez], [-ex, wallTop, sz * ez]);
    pushSegment(p, [0, ridge, sz * ez], [ex, wallTop, sz * ez]);
  }
  for (const sx of [-1, 1]) {
    pushSegment(p, [sx * ex, wallTop, -ez], [sx * ex, wallTop, ez]);
  }

  // Труба
  pushRect(p, CHIMNEY.x0, CHIMNEY.z0, CHIMNEY.x1, CHIMNEY.z1, CHIMNEY.top);
  for (const [cx, cz] of [
    [CHIMNEY.x0, CHIMNEY.z0],
    [CHIMNEY.x1, CHIMNEY.z0],
    [CHIMNEY.x1, CHIMNEY.z1],
    [CHIMNEY.x0, CHIMNEY.z1],
  ]) {
    const slope = 1 - Math.min(1, Math.abs(cx) / ex);
    const roofY = wallTop + slope * (ridge - wallTop);
    pushSegment(p, [cx, roofY, cz], [cx, CHIMNEY.top, cz]);
  }

  // Проёмы: дверь и окна рамками на своих стенах
  for (const opening of OPENINGS) {
    const corners: number[][] = [];
    if (opening.face === 'z+' || opening.face === 'z-') {
      const z = opening.face === 'z+' ? hz : -hz;
      corners.push(
        [opening.a0, opening.y0, z],
        [opening.a1, opening.y0, z],
        [opening.a1, opening.y1, z],
        [opening.a0, opening.y1, z],
      );
    } else {
      const x = opening.face === 'x+' ? hx : -hx;
      corners.push(
        [x, opening.y0, opening.a0],
        [x, opening.y0, opening.a1],
        [x, opening.y1, opening.a1],
        [x, opening.y1, opening.a0],
      );
    }
    for (let i = 0; i < 4; i++) {
      pushSegment(p, corners[i], corners[(i + 1) % 4]);
    }
  }

  // Мебель: рёбра объёмов и ножки стола
  for (const item of FURNITURE) {
    const top = floor + item.top;

    if (item.kind === 'table') {
      pushRect(p, item.x0, item.z0, item.x1, item.z1, top);
      for (const [lx, lz] of [
        [item.x0 + 0.12, item.z0 + 0.12],
        [item.x1 - 0.12, item.z0 + 0.12],
        [item.x1 - 0.12, item.z1 - 0.12],
        [item.x0 + 0.12, item.z1 - 0.12],
      ]) {
        pushSegment(p, [lx, floor, lz], [lx, top, lz]);
      }
      continue;
    }

    pushRect(p, item.x0, item.z0, item.x1, item.z1, floor);
    pushRect(p, item.x0, item.z0, item.x1, item.z1, top);
    for (const [cx, cz] of [
      [item.x0, item.z0],
      [item.x1, item.z0],
      [item.x1, item.z1],
      [item.x0, item.z1],
    ]) {
      pushSegment(p, [cx, floor, cz], [cx, top, cz]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
  return geometry;
}

export function HouseFrame() {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(buildStructure, []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.marker),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    const sample = ensureFrame(state.clock.elapsedTime, Math.min(delta, 0.05));
    const node = ref.current;
    if (!node) return;

    // Доля дома в текущей форме: каркас проявляется вместе с ней
    const weight =
      (sample.shapeA === SHAPE.HOUSE ? 1 - sample.shapeMix : 0) +
      (sample.shapeB === SHAPE.HOUSE ? sample.shapeMix : 0);

    node.visible = weight > 0.02;
    if (!node.visible) return;

    material.opacity = Math.pow(weight, 1.6) * 0.42;
  });

  return <lineSegments ref={ref} geometry={geometry} material={material} visible={false} />;
}
