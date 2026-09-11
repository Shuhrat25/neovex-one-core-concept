'use client';

import { usePublicState } from '@/lib/store';

/**
 * Раздел 9 ТЗ — цель проекта.
 *
 * Показывается на самом хвосте timeline, когда сцена уже вернулась к исходной
 * нейронной сфере: круг замкнулся, направления снова стали одним ядром.
 * Это оверлей, а не отдельная секция, — длина скролла остаётся ровно семь
 * равных состояний.
 */
export function EndCard() {
  const { tail } = usePublicState();

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      aria-hidden={!tail}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-5 px-6 pb-12 text-center transition-all duration-700 ${
        tail ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <div className="hairline h-px w-40" />

      <p className="max-w-[30rem] text-[clamp(0.9rem,1.4vw,1.05rem)] leading-relaxed text-white/55">
        AI, 3D, AR, VR, software и robotics — разные состояния одной
        технологической системы.
      </p>

      <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.28em]">
        <a
          href="https://neovex.uz/"
          target="_blank"
          rel="noreferrer"
          className={`border-b border-white/20 pb-0.5 text-white/60 transition-colors hover:border-accent hover:text-accent ${
            tail ? 'pointer-events-auto' : ''
          }`}
        >
          NEOVEX.UZ
        </a>
        <button
          type="button"
          onClick={backToTop}
          className={`text-white/35 transition-colors hover:text-accent ${
            tail ? 'pointer-events-auto' : ''
          }`}
        >
          В НАЧАЛО
        </button>
      </div>
    </div>
  );
}
