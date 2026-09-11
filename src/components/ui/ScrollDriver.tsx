'use client';

import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { setRawProgress } from '@/lib/store';

/**
 * Раздел 6 ТЗ: Scroll → Scroll Progress → Three.js Scene.
 *
 * Единственная точка, где страница разговаривает со сценой. ScrollTrigger
 * отдаёт нормализованный прогресс документа, дальше всё решает timeline.
 */
export function ScrollDriver() {
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => setRawProgress(self.progress),
    });

    // Перезагрузка страницы может произойти в середине документа
    setRawProgress(trigger.progress);

    return () => {
      trigger.kill();
    };
  }, []);

  return null;
}
