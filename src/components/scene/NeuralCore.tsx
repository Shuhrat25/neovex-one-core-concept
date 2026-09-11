'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { buildLinks } from '@/lib/connections';
import { ensureFrame } from '@/lib/frame';
import type { QualityBudget } from '@/lib/quality';
import { buildCoreShapes } from '@/lib/shapes';
import { scrollState, setReady } from '@/lib/store';
import { mulberry32 } from '@/lib/rng';

import { LINK_FRAGMENT, LINK_VERTEX } from './shaders/links';
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from './shaders/particles';
import { PALETTE } from './palette';

interface Props {
  budget: QualityBudget;
  /** Слои, живущие в системе координат объекта: контуры панелей, оснастка робота */
  children?: ReactNode;
}

const TAU = Math.PI * 2;

/** Переиспользуемый вектор — в кадре не создаём мусор для GC */
const pointerLocal = new THREE.Vector3();

/**
 * Основной объект сайта: нейронная сфера, которая проходит через все семь
 * состояний сценария. Частицы и связи — два draw call с общими юниформами,
 * поэтому связи всегда совпадают с узлами.
 */
export function NeuralCore({ budget, children }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const linksRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  const shapes = useMemo(() => buildCoreShapes(budget.particles), [budget.particles]);

  const links = useMemo(
    () => buildLinks(shapes.positions[0], shapes.count, budget.links),
    [shapes, budget.links],
  );

  /* --------------------------------------------------------------- *
   * Геометрия частиц
   * --------------------------------------------------------------- */
  const pointsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    // Форма 0 приходит через штатный атрибут position — shapeAt(0) читает его
    geometry.setAttribute('position', new THREE.BufferAttribute(shapes.positions[0], 3));
    geometry.setAttribute('aP1', new THREE.BufferAttribute(shapes.positions[1], 3));
    geometry.setAttribute('aP2', new THREE.BufferAttribute(shapes.positions[2], 3));
    geometry.setAttribute('aP3', new THREE.BufferAttribute(shapes.positions[3], 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(shapes.random, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(shapes.size, 1));
    // Реальные позиции считает вершинный шейдер, поэтому bounding sphere
    // задаём вручную и отключаем отсечение
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24);
    return geometry;
  }, [shapes]);

  /* --------------------------------------------------------------- *
   * Геометрия связей
   * --------------------------------------------------------------- */
  const linksGeometry = useMemo(() => {
    const vertexCount = links.count * 2;
    const geometry = new THREE.BufferGeometry();

    const position = new Float32Array(vertexCount * 3);
    const p1 = new Float32Array(vertexCount * 3);
    const p2 = new Float32Array(vertexCount * 3);
    const p3 = new Float32Array(vertexCount * 3);
    const random = new Float32Array(vertexCount);
    const threshold = new Float32Array(vertexCount);
    const end = new Float32Array(vertexCount);
    const isLong = new Float32Array(vertexCount);

    const targets = [position, p1, p2, p3];
    const rng = mulberry32(90210);

    for (let i = 0; i < links.count; i++) {
      const a = links.pairs[i * 2];
      const b = links.pairs[i * 2 + 1];
      // Порог видимости: часть связей есть всегда, остальные «загораются»
      // по мере роста активности сети. Длинные хорды держат рисунок объёма,
      // поэтому включаются рано
      const linkThreshold = links.long[i]
        ? rng() * 0.4
        : 0.25 + Math.pow(rng(), 0.8) * 0.75;

      for (let side = 0; side < 2; side++) {
        const source = side === 0 ? a : b;
        const vertex = i * 2 + side;

        for (let shape = 0; shape < targets.length; shape++) {
          const from = shapes.positions[shape];
          targets[shape][vertex * 3] = from[source * 3];
          targets[shape][vertex * 3 + 1] = from[source * 3 + 1];
          targets[shape][vertex * 3 + 2] = from[source * 3 + 2];
        }

        random[vertex] = shapes.random[source];
        threshold[vertex] = linkThreshold;
        end[vertex] = side;
        isLong[vertex] = links.long[i];
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aP1', new THREE.BufferAttribute(p1, 3));
    geometry.setAttribute('aP2', new THREE.BufferAttribute(p2, 3));
    geometry.setAttribute('aP3', new THREE.BufferAttribute(p3, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(random, 1));
    geometry.setAttribute('aThreshold', new THREE.BufferAttribute(threshold, 1));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geometry.setAttribute('aLong', new THREE.BufferAttribute(isLong, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24);

    return geometry;
  }, [links, shapes]);

  /* --------------------------------------------------------------- *
   * Юниформы: общий набор разделяется двумя материалами по ссылке
   * --------------------------------------------------------------- */
  const { particleUniforms, linkUniforms } = useMemo(() => {
    const shared = {
      uTime: { value: 0 },
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uMix: { value: 0 },
      uDeform: { value: 0.13 },
      uEnergy: { value: 0.32 },
      uScale: { value: 1 },
      uPointerPos: { value: new THREE.Vector3(0, 0, 3) },
      uPointerStrength: { value: 0 },
      uTransition: { value: 0 },
      uColorAccent: { value: new THREE.Color(PALETTE.accent) },
    };

    return {
      particleUniforms: {
        ...shared,
        uSize: { value: 3.1 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0.62 },
        uColorCore: { value: new THREE.Color(PALETTE.core) },
        uColorEdge: { value: new THREE.Color(PALETTE.edge) },
      },
      linkUniforms: {
        ...shared,
        uOpacity: { value: 0.4 },
        uLinkDensity: { value: 0.5 },
        uChord: { value: 1 },
        uColorLink: { value: new THREE.Color(PALETTE.link) },
      },
    };
  }, []);

  const particleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERTEX,
        fragmentShader: PARTICLE_FRAGMENT,
        uniforms: particleUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }),
    [particleUniforms],
  );

  const linkMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: LINK_VERTEX,
        fragmentShader: LINK_FRAGMENT,
        uniforms: linkUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }),
    [linkUniforms],
  );

  useEffect(() => {
    return () => {
      pointsGeometry.dispose();
      linksGeometry.dispose();
      particleMaterial.dispose();
      linkMaterial.dispose();
    };
  }, [pointsGeometry, linksGeometry, particleMaterial, linkMaterial]);

  /* --------------------------------------------------------------- *
   * Кадр
   * --------------------------------------------------------------- */
  useFrame((state, delta) => {
    const clamped = Math.min(delta, 0.05);
    const sample = ensureFrame(state.clock.elapsedTime, clamped);

    const pu = particleUniforms;
    pu.uTime.value = state.clock.elapsedTime;
    pu.uShapeA.value = sample.shapeA;
    pu.uShapeB.value = sample.shapeB;
    pu.uMix.value = sample.shapeMix;
    pu.uDeform.value = sample.deform;
    pu.uEnergy.value = sample.energy;
    pu.uScale.value = sample.scale;
    pu.uTransition.value = sample.transition;
    pu.uPixelRatio.value = state.viewport.dpr;

    // Курсор действует заметно только там, где сфера — герой кадра
    pu.uPointerStrength.value = sample.pointer * 0.45;

    // Точки мельчают, когда камера уходит внутрь среды (VR)
    pu.uSize.value = 3.1 * (0.8 + 0.2 * (1 - sample.ui));
    // Дом раскинут на большей площади, чем сфера: без компенсации яркости
    // комната внутри выглядит пустой
    pu.uOpacity.value = Math.min(1, 0.62 * sample.coreAlpha);

    linkUniforms.uLinkDensity.value = sample.links;
    linkUniforms.uChord.value = sample.chord;
    // В состоянии SOFTWARE рисунок держат контуры панелей и строки частиц,
    // поэтому линии связей уходят почти в ноль — иначе панели зарастают шумом
    linkUniforms.uOpacity.value =
      (0.3 + sample.energy * 0.35) * (1 - sample.ui * 0.72) * sample.coreAlpha;

    const group = groupRef.current;
    if (group) {
      // Положение и размер объекта задаёт timeline: в AR дом умещается
      // в ладони человека, в VR он же вырастает вокруг камеры
      group.position.set(sample.corePos[0], sample.corePos[1], sample.corePos[2]);
      group.scale.setScalar(sample.coreScale);

      // Медленное собственное вращение: объект живёт и без скролла.
      // Внутри дома его почти останавливаем — иначе комната кружится
      // вокруг наблюдателя
      group.rotation.y += clamped * (0.045 + sample.energy * 0.06) * sample.spin;
      group.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.13) * 0.09 * sample.spin;

      // Низкий spin означает, что у формы есть перёд, который обязан смотреть
      // на зрителя: у робота там лицо, у дома — дверь. Подтягиваем к ближайшему
      // фронтальному положению, оставляя лёгкое покачивание
      if (sample.facing > 0.01) {
        const turns = Math.round(group.rotation.y / TAU);
        const front = turns * TAU + Math.sin(state.clock.elapsedTime * 0.32) * 0.12;
        group.rotation.y += (front - group.rotation.y) * Math.min(1, sample.facing * clamped * 4);
      }

      // Лёгкий параллакс к курсору поверх собственного вращения
      const tilt = sample.pointer * 0.16;
      group.rotation.z += (scrollState.pointer.x * tilt - group.rotation.z) * 0.05;

      // Точка отталкивания задана в экранных координатах, а объект вращается —
      // переводим её в локальное пространство группы, иначе «ямка» от курсора
      // уезжает вместе с вращением
      pointerLocal.set(scrollState.pointer.x * 2.6, scrollState.pointer.y * 2.0, 1.9);
      group.worldToLocal(pointerLocal);
      pu.uPointerPos.value.copy(pointerLocal);
    }
  });

  useEffect(() => {
    // Первый кадр отрисован — снимаем прелоадер
    const id = requestAnimationFrame(() => {
      setReady(true);
      invalidate();
    });
    return () => cancelAnimationFrame(id);
  }, [invalidate]);

  return (
    <group ref={groupRef}>
      <lineSegments
        ref={linksRef}
        geometry={linksGeometry}
        material={linkMaterial}
        frustumCulled={false}
      />
      <points
        ref={pointsRef}
        geometry={pointsGeometry}
        material={particleMaterial}
        frustumCulled={false}
      />
      {children}
    </group>
  );
}
