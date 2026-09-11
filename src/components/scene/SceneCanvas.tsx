'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import { detectTier, getBudget, type QualityBudget } from '@/lib/quality';
import { setPointer } from '@/lib/store';

import { ARLayer } from './ARLayer';
import { CameraRig } from './CameraRig';
import { DustField } from './DustField';
import { Effects } from './Effects';
import { HouseFrame } from './HouseFrame';
import { FigureLayer } from './FigureLayer';
import { NeuralCore } from './NeuralCore';
import { PALETTE } from './palette';
import { RobotRig } from './RobotRig';
import { UIFrames } from './UIFrames';

/**
 * Единственная 3D-сцена сайта.
 *
 * Канвас зафиксирован на всю высоту вьюпорта и никогда не размонтируется:
 * секции скроллятся поверх него, а сцена продолжает один непрерывный timeline
 * (раздел 1 ТЗ — пользователь не переходит между статичными секциями).
 */
export function SceneCanvas() {
  const [budget, setBudget] = useState<QualityBudget | null>(null);

  // Тир считаем только на клиенте: на сервере нет ни экрана, ни GPU
  useEffect(() => {
    setBudget(getBudget(detectTier()));
  }, []);

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointer);
  }, []);

  const cameraSettings = useMemo(
    () => ({
      position: [0, 0, 5.4] as [number, number, number],
      fov: 45,
      // Ближняя плоскость подобрана под сценарий 05: камера проходит сквозь
      // облако частиц и не должна их срезать
      near: 0.05,
      far: 70,
    }),
    [],
  );

  if (!budget) {
    return <div className="fixed inset-0 z-0 bg-black" aria-hidden />;
  }

  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      <Canvas
        dpr={budget.dpr}
        camera={cameraSettings}
        gl={{
          antialias: budget.antialias,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(PALETTE.background), 1);
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/*
          Свет нужен единственному сплошному объекту сцены — человеку в AR.
          Частицы и связи рисуются собственными шейдерами и на свет не
          реагируют, поэтому источников ровно три: заполняющий, ключевой и
          холодный контровой, который отделяет силуэт от чёрного фона.
        */}
        <ambientLight intensity={0.35} color="#7f97ad" />
        <directionalLight position={[3.2, 4.5, 4]} intensity={2.1} color="#e8f6ff" />
        <directionalLight position={[-4, 1.5, -2.5]} intensity={1.6} color={PALETTE.accent} />

        <CameraRig />
        <DustField count={budget.dust} />

        <NeuralCore budget={budget}>
          {/* Слои в системе координат объекта: поворачиваются вместе с ним */}
          <HouseFrame />
          <UIFrames />
          <RobotRig />
        </NeuralCore>

        <FigureLayer budget={budget} />
        <ARLayer />

        {budget.postprocessing && <Effects intensity={budget.bloomIntensity} />}
      </Canvas>
    </div>
  );
}
