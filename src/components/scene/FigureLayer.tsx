'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { HUMAN_ATLAS, HUMAN_PARTS, sampleAtlas, type Part } from '@/lib/figures';
import type { QualityBudget } from '@/lib/quality';
import { mulberry32 } from '@/lib/rng';

import { PARTICLE_FRAGMENT } from './shaders/particles';
import { FIGURE_VERTEX } from './shaders/figure';
import { PALETTE } from './palette';

/**
 * Человек в сценариях 04 и 05.
 *
 * В AR он полноценная модель: сплошные скруглённые примитивы, свет, тень
 * силуэта — по контрасту с домом из точек в его ладони сразу читается, что
 * дом виртуальный, а человек настоящий.
 *
 * В VR он сам разбирается на точки и оказывается внутри того же дома —
 * теперь виртуально всё, включая наблюдаемого.
 */

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface SolidPart {
  kind: 'ellipsoid' | 'capsule';
  position: [number, number, number];
  scale: [number, number, number];
  quaternion: THREE.Quaternion;
  radius: number;
  length: number;
}

const UP = new THREE.Vector3(0, 1, 0);

function toSolid(part: Part): SolidPart {
  if (part.kind === 'ellipsoid') {
    return {
      kind: 'ellipsoid',
      position: part.c,
      scale: part.r,
      quaternion: new THREE.Quaternion(),
      radius: 1,
      length: 0,
    };
  }

  const axis = new THREE.Vector3(
    part.b[0] - part.a[0],
    part.b[1] - part.a[1],
    part.b[2] - part.a[2],
  );
  const length = axis.length();

  return {
    kind: 'capsule',
    position: [
      (part.a[0] + part.b[0]) / 2,
      (part.a[1] + part.b[1]) / 2,
      (part.a[2] + part.b[2]) / 2,
    ],
    scale: [1, 1, 1],
    // CapsuleGeometry строится вдоль Y — доворачиваем её на ось детали
    quaternion: new THREE.Quaternion().setFromUnitVectors(
      UP,
      axis.normalize(),
    ),
    radius: part.r,
    length,
  };
}

export function FigureLayer({ budget }: { budget: QualityBudget }) {
  const groupRef = useRef<THREE.Group>(null);
  const solidRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const solidParts = useMemo(() => HUMAN_PARTS.map(toSolid), []);

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  const capsuleGeometries = useMemo(() => {
    const cache = new Map<string, THREE.CapsuleGeometry>();
    for (const part of solidParts) {
      if (part.kind !== 'capsule') continue;
      const key = `${part.radius.toFixed(3)}_${part.length.toFixed(3)}`;
      if (cache.has(key)) continue;
      cache.set(key, new THREE.CapsuleGeometry(part.radius, part.length, 6, 16));
    }
    return cache;
  }, [solidParts]);

  const solidMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b9c7d6'),
        roughness: 0.42,
        metalness: 0.22,
        emissive: new THREE.Color('#0a2740'),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  /* --------------------------------------------------------------- *
   * Точечная версия той же фигуры
   * --------------------------------------------------------------- */
  const pointCount = Math.max(1200, Math.round(budget.particles * 0.26));

  const pointsGeometry = useMemo(() => {
    const random = mulberry32(4242);
    const positions = new Float32Array(pointCount * 3);
    const randoms = new Float32Array(pointCount);
    const sizes = new Float32Array(pointCount);

    for (let i = 0; i < pointCount; i++) {
      // Та же развёртка, что у ядра: точки ложатся на фигуру равномерно
      const dirY = 1 - (i / (pointCount - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - dirY * dirY));
      const theta = GOLDEN_ANGLE * i;
      const dirX = Math.cos(theta) * ring;
      const dirZ = Math.sin(theta) * ring;

      const u = Math.atan2(dirX, dirZ) / TAU + 0.5;
      const v = dirY * 0.5 + 0.5;
      const point = sampleAtlas(HUMAN_ATLAS, u, v);

      positions[i * 3] = point[0];
      positions[i * 3 + 1] = point[1];
      positions[i * 3 + 2] = point[2];

      randoms[i] = random();
      const roll = random();
      sizes[i] = roll > 0.98 ? 2 + random() * 0.8 : 0.5 + roll * 0.85;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    return geometry;
  }, [pointCount]);

  const pointsUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 3.1 },
      uPixelRatio: { value: 1 },
      uScatter: { value: 0 },
      uOpacity: { value: 0 },
      uEnergy: { value: 0.4 },
      uTransition: { value: 0 },
      uColorCore: { value: new THREE.Color(PALETTE.core) },
      uColorEdge: { value: new THREE.Color(PALETTE.edge) },
      uColorAccent: { value: new THREE.Color(PALETTE.accent) },
    }),
    [],
  );

  const pointsMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FIGURE_VERTEX,
        fragmentShader: PARTICLE_FRAGMENT,
        uniforms: pointsUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [pointsUniforms],
  );

  useEffect(() => {
    const capsules = [...capsuleGeometries.values()];
    return () => {
      sphereGeometry.dispose();
      capsules.forEach((geometry) => geometry.dispose());
      solidMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
    };
  }, [
    sphereGeometry,
    capsuleGeometries,
    solidMaterial,
    pointsGeometry,
    pointsMaterial,
  ]);

  useFrame((state, delta) => {
    const sample = ensureFrame(state.clock.elapsedTime, Math.min(delta, 0.05));
    const group = groupRef.current;
    if (!group) return;

    const visible = sample.figureSolid > 0.01 || sample.figurePoints > 0.01;
    group.visible = visible;
    if (!visible) return;

    group.position.set(
      sample.figurePos[0],
      sample.figurePos[1],
      sample.figurePos[2],
    );
    group.scale.setScalar(sample.figureScale);

    solidMaterial.opacity = sample.figureSolid;
    // Пока фигура полупрозрачна, она не должна писать глубину: иначе
    // на её месте в аддитивных точках дома остаётся тёмный силуэт
    solidMaterial.depthWrite = sample.figureSolid > 0.7;
    if (solidRef.current) solidRef.current.visible = sample.figureSolid > 0.04;

    pointsUniforms.uTime.value = state.clock.elapsedTime;
    pointsUniforms.uOpacity.value = sample.figurePoints * 0.85;
    pointsUniforms.uPixelRatio.value = state.viewport.dpr;
    pointsUniforms.uTransition.value = sample.transition;
    // Пока точек мало, они разлетаются — фигура «проявляется», а не возникает
    pointsUniforms.uScatter.value = (1 - sample.figurePoints) * 0.5;

    if (pointsRef.current) {
      pointsRef.current.visible = sample.figurePoints > 0.01;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <group ref={solidRef}>
        {solidParts.map((part, index) => {
          if (part.kind === 'ellipsoid') {
            return (
              <mesh
                key={index}
                geometry={sphereGeometry}
                material={solidMaterial}
                position={part.position}
                scale={part.scale}
              />
            );
          }

          const key = `${part.radius.toFixed(3)}_${part.length.toFixed(3)}`;
          const geometry = capsuleGeometries.get(key);
          if (!geometry) return null;

          return (
            <mesh
              key={index}
              geometry={geometry}
              material={solidMaterial}
              position={part.position}
              quaternion={part.quaternion}
            />
          );
        })}
      </group>

      <points
        ref={pointsRef}
        geometry={pointsGeometry}
        material={pointsMaterial}
        frustumCulled={false}
      />
    </group>
  );
}
