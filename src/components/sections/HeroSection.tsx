'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

import { STAGES } from '@/lib/stages';
import { GlitchText } from '@/components/ui/GlitchText';

/**
 * Сценарий 01 — HERO.
 *
 * Сфера уже в центре кадра, поэтому текст держится по краям композиции:
 * заголовок снизу, направления — строкой под ним. Центр экрана остаётся объекту.
 */
export function HeroSection({ active }: { active: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hero = STAGES[0];

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const context = gsap.context(() => {
      // Появление на загрузке: элементы собираются снизу с лёгким сдвигом
      gsap.fromTo(
        '[data-hero-item]',
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.12,
          delay: 0.35,
        },
      );
    }, node);

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    // При уходе со сцены герой растворяется, а не уезжает вместе со скроллом
    gsap.to(node, {
      autoAlpha: active ? 1 : 0,
      duration: 0.5,
      ease: 'power2.out',
      overwrite: true,
    });
  }, [active]);

  return (
    <section
      id={hero.id}
      aria-label="NEOVEX — ONE CORE"
      className="absolute inset-0 flex flex-col justify-end px-6 pb-[14svh] md:px-14 md:pr-36 lg:px-20 lg:pr-44"
    >
      <div ref={rootRef} className="scanlines text-scrim relative flex flex-col gap-6">
        <div
          data-hero-item
          className="flex items-center gap-3 font-mono text-[11px] tracking-[0.32em] text-accent/80"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span>{hero.code}</span>
          <span className="h-px w-10 bg-accent/40" />
          <span className="text-white/45">NEOVEX</span>
        </div>

        <div data-hero-item>
          <GlitchText
            as="h1"
            text={hero.title}
            active={active}
            delay={520}
            duration={900}
            className="font-display text-[clamp(3rem,12vw,9.5rem)] font-semibold leading-[0.86] tracking-[-0.035em]"
          />
        </div>

        <p
          data-hero-item
          className="max-w-[32rem] text-[clamp(0.95rem,1.6vw,1.15rem)] leading-relaxed text-white/62"
        >
          {hero.body}
        </p>

        <ul
          data-hero-item
          className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/40"
        >
          {hero.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
