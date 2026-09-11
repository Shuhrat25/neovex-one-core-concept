'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import type { BloomEffect, ChromaticAberrationEffect } from 'postprocessing';

import { ensureFrame } from '@/lib/frame';

/**
 * Постобработка.
 *
 * Свечение даёт узлам характер референса, а RGB-сдвиг привязан к тому же
 * значению перехода, что и glitch у текста (раздел 7 ТЗ): помехи в 3D и в
 * типографике должны случаться одновременно, иначе эффект распадается.
 */
export function Effects({ intensity }: { intensity: number }) {
  const bloomRef = useRef<BloomEffect>(null);
  const chromaRef = useRef<ChromaticAberrationEffect>(null);
  // Эффект хранит именно этот вектор — обновляем его на месте, без пересоздания
  const chromaOffset = useMemo(() => new Vector2(0, 0), []);

  useFrame((state, delta) => {
    const sample = ensureFrame(state.clock.elapsedTime, Math.min(delta, 0.05));

    if (bloomRef.current) {
      bloomRef.current.intensity = intensity * sample.bloom;
    }

    if (chromaRef.current) {
      const shift = sample.transition * 0.0035;
      chromaRef.current.offset.set(shift, shift * 0.55);
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        intensity={intensity}
        luminanceThreshold={0.32}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.62}
      />
      <ChromaticAberration
        ref={chromaRef}
        blendFunction={BlendFunction.NORMAL}
        offset={chromaOffset}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.035} />
      <Vignette eskil={false} offset={0.22} darkness={0.82} />
    </EffectComposer>
  );
}
