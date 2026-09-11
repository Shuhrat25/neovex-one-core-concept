'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { buildFigureWireframe, ROBOT_FACE, ROBOT_PARTS } from '@/lib/figures';
import { PALETTE } from './palette';

/**
 * Сценарий 07 — ROBOTICS.
 *
 * Точками читается объём, но не характер, поэтому поверх собранной фигуры
 * включается то, что делает робота роботом: экран-лицо, эмблема на груди,
 * подсветка суставов и опорная сетка.
 *
 * Слой живёт внутри группы ядра и вращается вместе с ним — иначе лицо
 * «отклеится» от головы, как только объект повернётся.
 */

const JOINTS: [number, number, number][] = [
  [-0.56, 0.42, 0.16],
  [0.56, 0.42, 0.16],
  [-0.28, -0.3, 0.14],
  [0.28, -0.3, 0.14],
];

const CHEST: [number, number, number] = [0, 0.22, 0.38];

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Экран-лицо рисуем на канве: это дешевле любой геометрии и точнее по форме */
function createFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 384);

    drawRoundedRect(ctx, 14, 14, 484, 356, 96);
    ctx.fillStyle = '#04121d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 225, 255, 0.5)';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.fillStyle = PALETTE.accent;
    ctx.shadowColor = PALETTE.accent;
    ctx.shadowBlur = 26;

    // Глаза: скруглённые полосы с лёгким наклоном
    ctx.save();
    ctx.translate(172, 168);
    ctx.rotate(-0.14);
    drawRoundedRect(ctx, -34, -52, 68, 104, 32);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(340, 168);
    ctx.rotate(0.14);
    drawRoundedRect(ctx, -34, -52, 68, 104, 32);
    ctx.fill();
    ctx.restore();

    // Улыбка
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(256, 214, 82, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildGrid(): THREE.BufferGeometry {
  const points: number[] = [];
  const half = 1.9;
  const step = 0.32;
  const y = -1.22;

  for (let v = -half; v <= half + 1e-6; v += step) {
    points.push(-half, y, v, half, y, v);
    points.push(v, y, -half, v, y, half);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export function RobotRig() {
  const groupRef = useRef<THREE.Group>(null);
  const gridGeometry = useMemo(buildGrid, []);
  const faceTexture = useMemo(createFaceTexture, []);

  const wireGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(buildFigureWireframe(ROBOT_PARTS), 3),
    );
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    return geometry;
  }, []);

  const wireMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.edge),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const gridMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE.link),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const faceMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [faceTexture],
  );

  const accentMaterial = useMemo(
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

  useEffect(() => {
    return () => {
      gridGeometry.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      gridMaterial.dispose();
      faceMaterial.dispose();
      accentMaterial.dispose();
      faceTexture.dispose();
    };
  }, [gridGeometry, wireGeometry, wireMaterial, gridMaterial, faceMaterial, accentMaterial, faceTexture]);

  useFrame((state, delta) => {
    const sample = ensureFrame(state.clock.elapsedTime, Math.min(delta, 0.05));
    const group = groupRef.current;
    if (!group) return;

    group.visible = sample.robot > 0.01;
    if (!group.visible) return;

    // Оснастка включается на последней трети сборки: сперва детали, потом питание
    const power = Math.pow(Math.max(0, sample.robot - 0.3) / 0.7, 1.3);
    const time = state.clock.elapsedTime;

    gridMaterial.opacity = power * 0.26;
    wireMaterial.opacity = Math.pow(sample.robot, 1.4) * 0.4;
    faceMaterial.opacity = power;
    accentMaterial.opacity = power * (0.45 + Math.sin(time * 2.6) * 0.12);
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={wireGeometry} material={wireMaterial} />
      <lineSegments geometry={gridGeometry} material={gridMaterial} />

      <mesh position={ROBOT_FACE} material={faceMaterial}>
        <planeGeometry args={[0.78, 0.58]} />
      </mesh>

      <mesh position={CHEST} material={accentMaterial}>
        <ringGeometry args={[0.13, 0.16, 32]} />
      </mesh>

      {JOINTS.map((position, index) => (
        <mesh key={index} position={position} material={accentMaterial}>
          <ringGeometry args={[0.11, 0.135, 24]} />
        </mesh>
      ))}
    </group>
  );
}
