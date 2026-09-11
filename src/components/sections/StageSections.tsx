'use client';

import { STAGE_COUNT, STAGES } from '@/lib/stages';
import { usePublicState } from '@/lib/store';

import { HeroSection } from './HeroSection';
import { StageSection } from './StageSection';

/**
 * Раскладка текстовых блоков.
 *
 * Прокрутка здесь — это шкала одного timeline, а не лента секций. Поэтому
 * высоту документа задаёт отдельная полоса (по экрану на каждое состояние
 * плюс экран на возврат к сфере), а сами тексты живут в закреплённом слое и
 * переключаются строго по прогрессу. Иначе заголовок неизбежно расходится
 * со своим состоянием сцены: секции считаются от своей высоты, а прогресс —
 * от высоты всего документа минус экран.
 *
 * Центр кадра почти всегда отдан объекту — текст уходит к краям и меняет
 * сторону от секции к секции (раздел 8: не перегружать экран UI-элементами).
 */
const ALIGNMENT = ['center', 'left', 'right', 'left', 'left', 'right', 'left'] as const;

export function StageSections() {
  const { stage, tail } = usePublicState();

  return (
    <>
      <div
        aria-hidden
        className="w-full"
        style={{ height: `${(STAGE_COUNT + 1) * 100}svh` }}
      />

      <div className="pointer-events-none fixed inset-0 z-10">
        <HeroSection active={stage === 0} />

        {STAGES.slice(1).map((item, offset) => {
          const index = offset + 1;
          // На хвосте timeline текст робототехники уходит: сцена возвращается
          // к исходной сфере, и её не должен перекрывать заголовок состояния
          const isLastFading = index === STAGE_COUNT - 1 && tail;

          return (
            <StageSection
              key={item.id}
              stage={item}
              active={stage === index && !isLastFading}
              align={ALIGNMENT[index]}
            />
          );
        })}
      </div>
    </>
  );
}
