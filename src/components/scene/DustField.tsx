'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { mulberry32 } from '@/lib/rng';
import { PALETTE } from './palette';

/**
 * Фоновая пыль. Собственной смысловой нагрузки не несёт — задаёт глубину и
 * масштаб, чтобы главный объект не висел в пустоте. Живёт далеко от камеры и
 * не перетягивает внимание (раздел 8: центр внимания — сфера).
 */
export function DustField({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const random = mulberry32(777);
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      const radius = 9 + random() * 17;

      positions[i * 3] = Math.cos(angle) * r * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = Math.sin(angle) * r * radius;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(PALETTE.edge),
        size: 0.035,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
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
    const clamped = Math.min(delta, 0.05);
    const sample = ensureFrame(state.clock.elapsedTime, clamped);
    const node = ref.current;
    if (!node) return;

    node.rotation.y += clamped * 0.012;
    // Внутри VR-среды фон почти гасим: пространство должно строить сам объект
    material.opacity = 0.5 * (1 - sample.ui * 0.6) * (1 - sample.ar * 0.35);
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
