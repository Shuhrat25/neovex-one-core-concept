'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

import { ensureFrame } from '@/lib/frame';
import { scrollState } from '@/lib/store';

const target = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const offset = new THREE.Vector3();

/**
 * Камера — часть общего timeline: её положение, цель и угол обзора берутся из
 * того же состояния сцены. В VR (сценарий 05) камера уходит внутрь структуры,
 * поэтому FOV и near-плоскость меняются вместе с позицией.
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const current = useRef(new THREE.Vector3(0, 0, 5.4));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state, delta) => {
    const clamped = Math.min(delta, 0.05);
    const sample = ensureFrame(state.clock.elapsedTime, clamped);

    // Параллакс от курсора добавляется к позиции с timeline, а не заменяет её
    const parallax = sample.pointer * 0.35;
    target.set(
      sample.camera[0] + scrollState.pointer.x * parallax,
      sample.camera[1] + scrollState.pointer.y * parallax * 0.6,
      sample.camera[2],
    );
    lookTarget.set(sample.lookAt[0], sample.lookAt[1], sample.lookAt[2]);

    // Кадрирование под пропорции экрана.
    //
    // Позиции камеры в timeline подобраны под широкий экран. На вертикальном
    // телефоне то же расстояние обрезает объект по бокам, поэтому камера
    // отъезжает ровно настолько, чтобы радиус сцены поместился в кадр
    // (раздел 8 ТЗ — адаптивность для desktop, tablet и mobile).
    if (sample.frameX > 0.001 || sample.frameY > 0.001) {
      const halfFov = Math.tan(THREE.MathUtils.degToRad(sample.fov) / 2);
      // Расстояние, на котором помещается высота, и то, на котором помещается
      // ширина. Берём большее — что не влезает, то и определяет кадр
      const forHeight = sample.frameY / halfFov;
      const forWidth = sample.frameX / (halfFov * Math.max(camera.aspect, 0.001));
      const needed = Math.max(forHeight, forWidth);

      offset.copy(target).sub(lookTarget);
      const distance = offset.length();
      if (distance > 0.001 && needed > distance) {
        target.copy(lookTarget).addScaledVector(offset.divideScalar(distance), needed);
      }

      // На вертикальном экране текст занимает низ кадра, поэтому весь вид
      // опускается — объект уходит в верхнюю половину и не спорит с текстом
      if (camera.aspect < 0.9) {
        const lift = Math.min(0.5, 0.9 - camera.aspect) * sample.frameY * 0.75;
        target.y -= lift;
        lookTarget.y -= lift;
      }
    }

    // Инерция: скролл может дёргаться, движение камеры — нет
    const damping = 1 - Math.pow(0.001, clamped);
    current.current.lerp(target, damping);
    currentLook.current.lerp(lookTarget, damping);

    camera.position.copy(current.current);
    camera.lookAt(currentLook.current);

    const nextFov = THREE.MathUtils.lerp(camera.fov, sample.fov, damping);
    if (Math.abs(nextFov - camera.fov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
