'use client';

import { useRef } from 'react';

import { scrollState, useStage } from '@/lib/store';
import { STAGES } from '@/lib/stages';
import { useRaf } from '@/lib/useRaf';

/**
 * Верхняя строка: марка, текущее состояние и ссылка на сайт компании.
 * Ничего лишнего — по ТЗ внимание держит объект, а не интерфейс.
 */
export function Nav() {
  const barRef = useRef<HTMLDivElement>(null);
  const stage = useStage();
  const current = STAGES[stage] ?? STAGES[0];

  useRaf(() => {
    const node = barRef.current;
    if (!node) return;
    node.style.transform = `scaleX(${Math.max(0.001, scrollState.progress)})`;
  });

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
      <div className="h-px w-full bg-white/8">
        <div
          ref={barRef}
          className="h-full origin-left bg-accent/70"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-5 md:px-14 lg:px-20">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-sm font-semibold tracking-[0.34em]">
            NEOVEX
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.28em] text-white/35 sm:inline">
            ONE CORE
          </span>
        </div>

        <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.26em] text-white/35">
          <span className="hidden md:inline">
            <span className="text-accent">{current.code}</span>
            <span className="px-2 text-white/20">/</span>
            <span>{current.label}</span>
          </span>
          <a
            href="https://neovex.uz/"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto border-b border-white/15 pb-0.5 transition-colors hover:border-accent hover:text-accent"
          >
            NEOVEX.UZ
          </a>
        </div>
      </div>
    </header>
  );
}
