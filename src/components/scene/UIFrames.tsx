'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { UI_PANELS } from '@/lib/shapes';
import { PALETTE } from './palette';

/**
 * Сценарий 06 — SOFTWARE.
 *
 * Частицы к этому моменту уже перестроились в панели; тонкие контуры поверх них
 * дочитывают форму как интерфейс. Рамки берут те же панели, что и облако точек,
 * поэтому контур всегда совпадает с частицами.
 */
function buildFrames(): THREE.BufferGeometry {
  const points: number[] = [];

  for (const panel of UI_PANELS) {
    const halfW = panel.w / 2;
    const halfH = panel.h / 2;
    const cos = Math.cos(panel.ry);
    const sin = Math.sin(panel.ry);

    const corners: [number, number][] = [
      [-halfW, halfH],
      [halfW, halfH],
      [halfW, -halfH],
      [-halfW, -halfH],
    ];

    const world = corners.map(([lx, ly]) => [
      panel.x + lx * cos,
      panel.y + ly,
      panel.z - lx * sin,
    ]);

    for (let i = 0; i < 4; i++) {
      const a = world[i];
      const b = world[(i + 1) % 4];
      points.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }

    // Разделитель шапки панели — деталь, которая читается как UI
    const headerY = panel.y + halfH - Math.min(0.22, panel.h * 0.2);
    points.push(
      panel.x - halfW * cos, headerY, panel.z + halfW * sin,
      panel.x + halfW * cos, headerY, panel.z - halfW * sin,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export function UIFrames() {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(buildFrames, []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.accent),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state, delta) => {
    const sample = ensureFrame(state.clock.elapsedTime, Math.min(delta, 0.05));
    const node = ref.current;
    if (!node) return;

    node.visible = sample.ui > 0.01;
    if (!node.visible) return;

    // Панели собираются: контур проявляется чуть позже частиц
    const appear = Math.pow(sample.ui, 1.8);
    material.opacity = appear * 0.5;
    node.scale.setScalar(0.94 + appear * 0.06);
  });

  return <lineSegments ref={ref} geometry={geometry} material={material} visible={false} />;
}
