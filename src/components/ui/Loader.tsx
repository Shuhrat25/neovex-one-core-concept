'use client';

import { useEffect, useState } from 'react';

import { useSceneReady } from '@/lib/store';

/**
 * Экран загрузки.
 *
 * Держит чёрный кадр, пока WebGL-сцена не отдала первый кадр: иначе на секунду
 * виден пустой макет без объекта, ради которого сайт и сделан.
 */
export function Loader() {
  const ready = useSceneReady();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!ready) return;
    // Небольшая задержка — шейдеры компилируются в первом кадре, и уход
    // прелоадера не должен совпасть с этим рывком
    const timer = setTimeout(() => setHidden(true), 420);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    document.body.style.overflow = hidden ? '' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [hidden]);

  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-700 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <span className="font-display text-sm font-semibold tracking-[0.42em] text-white/80">
          NEOVEX
        </span>
        <span className="relative block h-px w-40 overflow-hidden bg-white/10">
          <span
            className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-700 ease-out"
            style={{ width: ready ? '100%' : '35%' }}
          />
        </span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/30">
          {ready ? 'CORE ONLINE' : 'BUILDING CORE'}
        </span>
      </div>
    </div>
  );
}
