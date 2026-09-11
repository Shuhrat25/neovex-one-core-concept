'use client';

import { useEffect, useRef } from 'react';

/**
 * Кадровый цикл для интерфейса.
 *
 * Прогресс-рейл и подсказка скролла обновляются каждый кадр, но их значения
 * не должны проходить через состояние React — пишем прямо в DOM.
 */
export function useRaf(callback: () => void) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      ref.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
}
