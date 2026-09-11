'use client';

import { useCallback, useRef } from 'react';

import { STAGES } from '@/lib/stages';
import { scrollState, useStage } from '@/lib/store';
import { progressForStage } from '@/lib/timeline';
import { useRaf } from '@/lib/useRaf';

/**
 * Индикатор положения на общем timeline.
 *
 * Это не навигация по разделам, а шкала одного непрерывного сценария —
 * поэтому вместо пунктов меню коды состояний, а сам бегунок движется плавно,
 * а не прыгает между отметками.
 */
export function ProgressRail() {
  const fillRef = useRef<HTMLDivElement>(null);
  const stage = useStage();

  useRaf(() => {
    const node = fillRef.current;
    if (!node) return;
    node.style.transform = `scaleY(${Math.max(0.001, scrollState.progress)})`;
  });

  const goToStage = useCallback((index: number) => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: progressForStage(index) * scrollable,
      behavior: 'smooth',
    });
  }, []);

  return (
    <nav
      aria-label="Состояния сцены"
      className="pointer-events-none fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:right-8"
    >
      <div className="relative flex gap-4">
        <div className="relative w-px bg-white/12">
          <div
            ref={fillRef}
            className="absolute inset-x-0 top-0 h-full origin-top bg-accent"
            style={{ transform: 'scaleY(0)' }}
          />
        </div>

        <ul className="pointer-events-auto flex flex-col justify-between gap-6 py-1">
          {STAGES.map((item, index) => {
            const isActive = index === stage;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goToStage(index)}
                  aria-current={isActive ? 'true' : undefined}
                  className="group flex items-center gap-2.5 font-mono text-[10px] tracking-[0.22em] transition-colors"
                >
                  <span
                    className={`h-px transition-all duration-500 ${
                      isActive ? 'w-5 bg-accent' : 'w-2.5 bg-white/25 group-hover:w-4'
                    }`}
                  />
                  <span
                    className={`transition-colors duration-500 ${
                      isActive ? 'text-accent' : 'text-white/35 group-hover:text-white/70'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
