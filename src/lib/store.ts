'use client';

import { useSyncExternalStore } from 'react';
import { STAGE_COUNT } from './stages';

/**
 * Раздел 6 ТЗ: Scroll → Scroll Progress → Three.js Scene.
 *
 * Прогресс живёт вне React: его читает рендер-цикл через ref, чтобы 60 fps
 * не упирались в перерисовку дерева компонентов. В React наружу выходит
 * только «дискретная» часть состояния (активная стадия, флаг перехода).
 */

export interface ScrollState {
  /** Сырой прогресс скролла страницы, 0…1 */
  raw: number;
  /** Сглаженный прогресс — им управляется вся 3D-сцена */
  progress: number;
  /** Скорость изменения прогресса (для усиления glitch на быстром скролле) */
  velocity: number;
  /** Индекс активного состояния 0…6 */
  stage: number;
  /** Интенсивность перехода между состояниями, 0…1 */
  transition: number;
  /** Нормализованная позиция курсора, -1…1 */
  pointer: { x: number; y: number };
  /** Сцена готова к показу (шейдеры скомпилированы, первый кадр отрисован) */
  ready: boolean;
}

export const scrollState: ScrollState = {
  raw: 0,
  progress: 0,
  velocity: 0,
  stage: 0,
  transition: 0,
  pointer: { x: 0, y: 0 },
  ready: false,
};

/* ------------------------------------------------------------------ *
 * Публичный (React-видимый) срез — меняется редко
 * ------------------------------------------------------------------ */

export interface PublicState {
  stage: number;
  ready: boolean;
  /** Хвост timeline: сцена уже возвращается к исходной сфере */
  tail: boolean;
  /** transition, квантованный до 0.05 — чтобы не дёргать React каждый кадр */
  transitionStep: number;
}

let publicState: PublicState = { stage: 0, ready: false, tail: false, transitionStep: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PublicState {
  return publicState;
}

const SERVER_SNAPSHOT: PublicState = { stage: 0, ready: false, tail: false, transitionStep: 0 };
function getServerSnapshot(): PublicState {
  return SERVER_SNAPSHOT;
}

function syncPublicState() {
  const step = Math.round(scrollState.transition * 20) / 20;
  const tail = scrollState.progress > 0.95;
  if (
    publicState.stage === scrollState.stage &&
    publicState.ready === scrollState.ready &&
    publicState.tail === tail &&
    publicState.transitionStep === step
  ) {
    return;
  }
  publicState = {
    stage: scrollState.stage,
    ready: scrollState.ready,
    tail,
    transitionStep: step,
  };
  emit();
}

/* ------------------------------------------------------------------ *
 * Мутаторы
 * ------------------------------------------------------------------ */

export function setRawProgress(value: number) {
  scrollState.raw = Math.min(1, Math.max(0, value));
}

export function setPointer(x: number, y: number) {
  scrollState.pointer.x = x;
  scrollState.pointer.y = y;
}

export function setReady(value: boolean) {
  if (scrollState.ready === value) return;
  scrollState.ready = value;
  syncPublicState();
}

/**
 * Догоняем сырой прогресс с инерцией — движение сферы должно быть плавным,
 * даже если колесо мыши даёт рывки (раздел 8: «анимации должны быть плавными»).
 */
export function advance(delta: number) {
  const damping = 1 - Math.pow(0.0016, Math.min(delta, 0.1));
  const previous = scrollState.progress;
  scrollState.progress += (scrollState.raw - scrollState.progress) * damping;

  const instantVelocity = delta > 0 ? Math.abs(scrollState.progress - previous) / delta : 0;
  scrollState.velocity += (instantVelocity - scrollState.velocity) * 0.15;

  const stage = Math.min(
    STAGE_COUNT - 1,
    Math.max(0, Math.floor(scrollState.progress * STAGE_COUNT + 1e-6)),
  );
  scrollState.stage = stage;

  syncPublicState();
}

export function setTransition(value: number) {
  scrollState.transition = value;
}

/* ------------------------------------------------------------------ *
 * Хуки
 * ------------------------------------------------------------------ */

export function usePublicState(): PublicState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useStage(): number {
  return usePublicState().stage;
}

export function useSceneReady(): boolean {
  return usePublicState().ready;
}
