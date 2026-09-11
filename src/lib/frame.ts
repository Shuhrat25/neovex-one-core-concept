'use client';

import { advance, scrollState, setTransition } from './store';
import { sampleTimeline, type SceneSample } from './timeline';

/**
 * Один расчёт состояния сцены на кадр.
 *
 * Камера, ядро, фигура и постобработка читают одно и то же состояние. Чтобы не
 * зависеть от порядка подписок useFrame, расчёт защищён меткой времени: первый
 * вызов в кадре считает, остальные получают готовый результат.
 */

export const frameState: SceneSample = {
  shapeA: 0,
  shapeB: 0,
  shapeMix: 0,
  deform: 0.13,
  energy: 0.32,
  links: 0.5,
  chord: 1,
  scale: 1,
  corePos: [0, 0, 0],
  coreScale: 1,
  spin: 1,
  facing: 0,
  camera: [0, 0, 5.4],
  lookAt: [0, 0, 0],
  fov: 45,
  ar: 0,
  ui: 0,
  robot: 0,
  figureSolid: 0,
  figurePoints: 0,
  figurePos: [0, 0, 0],
  figureScale: 1,
  coreAlpha: 1,
  bloom: 1,
  pointer: 1,
  frameX: 1.95,
  frameY: 1.95,
  transition: 0,
};

let lastElapsed = -1;

function copyTriple(
  out: [number, number, number],
  from: [number, number, number],
) {
  out[0] = from[0];
  out[1] = from[1];
  out[2] = from[2];
}

export function ensureFrame(elapsed: number, delta: number): SceneSample {
  if (elapsed === lastElapsed) return frameState;
  lastElapsed = elapsed;

  advance(delta);
  const sample = sampleTimeline(scrollState.progress);

  frameState.shapeA = sample.shapeA;
  frameState.shapeB = sample.shapeB;
  frameState.shapeMix = sample.shapeMix;
  frameState.deform = sample.deform;
  frameState.energy = sample.energy;
  frameState.links = sample.links;
  frameState.chord = sample.chord;
  frameState.scale = sample.scale;
  frameState.coreScale = sample.coreScale;
  frameState.spin = sample.spin;
  frameState.facing = sample.facing;
  frameState.fov = sample.fov;
  frameState.ar = sample.ar;
  frameState.ui = sample.ui;
  frameState.robot = sample.robot;
  frameState.figureSolid = sample.figureSolid;
  frameState.figurePoints = sample.figurePoints;
  frameState.figureScale = sample.figureScale;
  frameState.coreAlpha = sample.coreAlpha;
  frameState.bloom = sample.bloom;
  frameState.pointer = sample.pointer;
  frameState.frameX = sample.frameX;
  frameState.frameY = sample.frameY;

  copyTriple(frameState.corePos, sample.corePos);
  copyTriple(frameState.camera, sample.camera);
  copyTriple(frameState.lookAt, sample.lookAt);
  copyTriple(frameState.figurePos, sample.figurePos);

  // Быстрый скролл усиливает переход: помехи появляются и от скорости, а не
  // только от положения на timeline
  const velocityBoost = Math.min(1, scrollState.velocity * 1.6);
  frameState.transition = Math.min(1, sample.transition + velocityBoost * 0.45);

  setTransition(frameState.transition);

  return frameState;
}
