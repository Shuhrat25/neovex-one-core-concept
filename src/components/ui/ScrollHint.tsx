'use client';

import { useRef } from 'react';

import { scrollState } from '@/lib/store';
import { useRaf } from '@/lib/useRaf';

/**
 * Подсказка о том, что скролл управляет сценой. Гаснет, как только
 * пользователь начал листать, и больше не возвращается на этой сессии.
 */
export function ScrollHint() {
  const ref = useRef<HTMLDivElement>(null);
  const dismissed = useRef(false);

  useRaf(() => {
    const node = ref.current;
    if (!node || dismissed.current) return;

    if (scrollState.progress > 0.012) {
      dismissed.current = true;
      node.style.opacity = '0';
      node.style.transform = 'translateY(12px)';
      return;
    }

    node.style.opacity = '1';
  });

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex flex-col items-center gap-3 opacity-0 transition-[opacity,transform] duration-700"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
        Scroll
      </span>
      <span className="relative block h-10 w-px overflow-hidden bg-white/12">
        <span className="scroll-hint-beam absolute inset-x-0 top-0 block h-3 bg-accent" />
      </span>
    </div>
  );
}
