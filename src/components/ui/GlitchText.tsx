'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ElementType,
  type HTMLAttributes,
} from 'react';

import { usePublicState } from '@/lib/store';
import { prefersReducedMotion } from '@/lib/quality';

/**
 * Раздел 7 ТЗ — glitch-эффект текста.
 *
 * Два независимых источника помех:
 *   1. появление блока — посимвольная «сборка» текста из мусорных глифов;
 *   2. состояние сцены — интенсивность берётся из того же значения перехода,
 *      что и деформация сферы, поэтому текст рябит ровно тогда, когда
 *      перестраивается 3D-объект.
 */

const GLYPHS = '01<>[]{}/\\*#%&$@!?ABCDEFXYZ▮▯░▒▓';

interface Props {
  text: string;
  /** Блок в активной секции — запускает сборку текста */
  active: boolean;
  as?: ElementType;
  className?: string;
  /** Задержка появления, мс — чтобы заголовок и описание шли не разом */
  delay?: number;
  /** Скорость сборки, мс на полный проход */
  duration?: number;
}

export function GlitchText({
  text,
  active,
  as: Tag = 'span',
  className = '',
  delay = 0,
  duration = 620,
}: Props) {
  const [rendered, setRendered] = useState(text);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { transitionStep } = usePublicState();

  useEffect(() => {
    if (prefersReducedMotion()) {
      setRendered(text);
      return;
    }

    const stop = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      frameRef.current = null;
      timeoutRef.current = null;
    };

    if (!active) {
      stop();
      setRendered(text);
      return stop;
    }

    // Символы проявляются слева направо; пока символ не «схватился»,
    // на его месте мелькает случайный глиф
    const start = performance.now() + delay;

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;

      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / duration);
      const settled = progress * text.length;

      let output = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') {
          output += ' ';
          continue;
        }
        if (i < settled - 1) {
          output += char;
        } else if (i < settled + 3) {
          output += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        } else {
          output += ' ';
        }
      }

      setRendered(output);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setRendered(text);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return stop;
  }, [active, text, delay, duration]);

  // Помехи от сцены гасим, пока блок не активен: фон не должен мигать
  const intensity = active ? transitionStep : 0;

  // Тег приходит параметром, поэтому приводим его к единому набору
  // HTML-пропсов: иначе объединение всех возможных элементов схлопывается
  const Component = Tag as ComponentType<
    HTMLAttributes<HTMLElement> & { 'data-text': string }
  >;

  return (
    <Component
      className={`glitch ${intensity > 0.5 ? 'glitch-burst' : ''} ${className}`}
      data-text={rendered}
      style={{ '--glitch': intensity } as CSSProperties}
    >
      {rendered}
    </Component>
  );
}
