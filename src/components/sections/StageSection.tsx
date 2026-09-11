'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

import type { Stage } from '@/lib/stages';
import { GlitchText } from '@/components/ui/GlitchText';

/**
 * Текстовый блок одного состояния сцены.
 *
 * Активность блока берётся из прогресса скролла, а не из положения элемента в
 * DOM: сцена и текст обязаны переключаться одновременно, иначе заголовок
 * приедет раньше, чем сфера примет новую форму.
 */

type Align = 'center' | 'left' | 'right';

interface Props {
  stage: Stage;
  active: boolean;
  align: Align;
}

const ALIGN_CLASS: Record<Align, string> = {
  center: 'items-center text-center',
  left: 'items-start text-left',
  right: 'items-start text-left md:items-end md:text-right',
};

const POSITION_CLASS: Record<Align, string> = {
  center: 'justify-center',
  left: 'justify-start',
  right: 'justify-start md:justify-end',
};

export function StageSection({ stage, active, align }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const context = gsap.context(() => {
      gsap.to(node, {
        autoAlpha: active ? 1 : 0,
        y: active ? 0 : 26,
        filter: active ? 'blur(0px)' : 'blur(6px)',
        duration: active ? 0.85 : 0.4,
        ease: active ? 'power3.out' : 'power2.in',
        overwrite: true,
      });
    }, node);

    return () => context.revert();
  }, [active]);

  // Правый отступ на широких экранах держит текст в стороне от прогресс-рейла:
  // без него строки заходят под его подписи
  return (
    <section
      id={stage.id}
      aria-label={stage.title}
      className={`absolute inset-0 flex items-end px-6 pb-[9svh] md:items-center md:px-14 md:pb-0 md:pr-36 lg:px-20 lg:pr-44 ${POSITION_CLASS[align]}`}
    >
      <div
        ref={wrapRef}
        style={{ opacity: 0, visibility: 'hidden' }}
        className={`scanlines text-scrim relative flex max-w-[34rem] flex-col gap-5 ${ALIGN_CLASS[align]}`}
      >
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.32em] text-accent/80">
          <span>{stage.code}</span>
          <span className="h-px w-10 bg-accent/40" />
          <span className="text-white/45">{stage.lead}</span>
        </div>

        <GlitchText
          as="h2"
          text={stage.title}
          active={active}
          delay={90}
          className="font-display text-[clamp(2.1rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.02em]"
        />

        <p className="max-w-[30rem] text-[clamp(0.95rem,1.5vw,1.1rem)] leading-relaxed text-white/62">
          {stage.body}
        </p>

        <ul className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/35">
          {stage.tags.map((tag) => (
            <li key={tag} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent/70" />
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
