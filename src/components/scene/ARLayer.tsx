'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { PALETTE } from './palette';

/**
 * Сценарий 04 — AUGMENTED REALITY.
 *
 * Разметка ложится на композицию «человек с моделью дома в руке»: прицелы
 * привязаны к дому, голове, ладони и опоре, от каждого идёт выноска. Слой
 * живёт в мировых координатах и не вращается вместе с домом — он про
 * наблюдателя, а не про объект.
 */

interface Marker {
  position: [number, number, number];
  scale: number;
  /** Куда уходит выноска от маркера */
  leader: [number, number, number];
}

const MARKERS: Marker[] = [
  // Модель дома в ладони — главный объект разметки
  { position: [1.0, 1.5, 0.5], scale: 0.9, leader: [1.62, 1.78, 0.5] },
  // Голова человека
  { position: [0, 1.34, 0.3], scale: 0.7, leader: [-0.95, 1.72, 0.3] },
  // Раскрытая ладонь
  { position: [0.95, 0.44, 0.55], scale: 0.55, leader: [1.58, 0.08, 0.55] },
  // Опора
  { position: [-0.22, -1.48, 0.25], scale: 0.5, leader: [-1.0, -1.72, 0.25] },
];

/** Кадр разметки: композиция смещена вправо, значит и рамка тоже */
const FRAME_CENTER: [number, number] = [0.45, 0];
const FRAME_HALF_X = 1.52;
const FRAME_HALF_Y = 1.88;
const BRACKET = 0.42;

function buildBrackets(): THREE.BufferGeometry {
  const points: number[] = [];
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ];

  for (const [sx, sy] of corners) {
    const x = FRAME_CENTER[0] + sx * FRAME_HALF_X;
    const y = FRAME_CENTER[1] + sy * FRAME_HALF_Y;
    // Горизонтальная часть скобки
    points.push(x, y, 0, x - sx * BRACKET, y, 0);
    // Вертикальная часть скобки
    points.push(x, y, 0, x, y - sy * BRACKET, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildLeaders(): THREE.BufferGeometry {
  const points: number[] = [];
  for (const marker of MARKERS) {
    points.push(...marker.position, ...marker.leader);
    // Короткая полка на конце выноски — как подпись без текста
    points.push(
      ...marker.leader,
      marker.leader[0] + (marker.leader[0] > FRAME_CENTER[0] ? 0.3 : -0.3),
      marker.leader[1],
      marker.leader[2],
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export function ARLayer() {
  const groupRef = useRef<THREE.Group>(null);
  const markerRefs = useRef<(THREE.Group | null)[]>([]);
  const scanRef = useRef<THREE.Mesh>(null);
  const camera = useThree((state) => state.camera);

  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.17, 0.2, 40), []);
  const dotGeometry = useMemo(() => new THREE.CircleGeometry(0.035, 16), []);
  const bracketGeometry = useMemo(buildBrackets, []);
  const leaderGeometry = useMemo(buildLeaders, []);

  const markerMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.marker),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const lineMaterial = useMemo(
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

  const scanMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
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
    const group = groupRef.current;
    if (!group) return;

    const strength = sample.ar;
    group.visible = strength > 0.01;
    if (!group.visible) return;

    const time = state.clock.elapsedTime;

    markerMaterial.opacity = strength * 0.9;
    lineMaterial.opacity = strength * 0.55;
    scanMaterial.opacity = strength * 0.22;

    // Маркеры всегда развёрнуты к камере и слегка «дышат»
    markerRefs.current.forEach((marker, index) => {
      if (!marker) return;
      marker.quaternion.copy(camera.quaternion);
      const breath = 1 + Math.sin(time * 1.6 + index * 1.3) * 0.06;
      const base = MARKERS[index].scale;
      marker.scale.setScalar(base * breath * (0.6 + strength * 0.4));
      marker.rotation.z = time * (index % 2 === 0 ? 0.4 : -0.3);
    });

    // Линия сканирования проходит композицию снизу вверх
    if (scanRef.current) {
      const sweep = ((time * 0.35) % 1) * 2 - 1;
      scanRef.current.position.y = FRAME_CENTER[1] + sweep * FRAME_HALF_Y * 0.95;
      scanRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={bracketGeometry} material={lineMaterial} />
      <lineSegments geometry={leaderGeometry} material={lineMaterial} />

      {MARKERS.map((marker, index) => (
        <group
          key={index}
          position={marker.position}
          ref={(node) => {
            markerRefs.current[index] = node;
          }}
        >
          <mesh geometry={ringGeometry} material={markerMaterial} />
          <mesh geometry={dotGeometry} material={markerMaterial} />
        </group>
      ))}

      <mesh ref={scanRef} position={[FRAME_CENTER[0], 0, 0]} material={scanMaterial}>
        <planeGeometry args={[FRAME_HALF_X * 2.1, 0.012]} />
      </mesh>
    </group>
  );
}
