/**
 * Сценарий страницы из ТЗ (раздел 5).
 * Семь состояний одной непрерывной 3D-сцены — не семь независимых секций.
 */

export type StageId =
  | 'hero'
  | 'ai'
  | 'three-d'
  | 'ar'
  | 'vr'
  | 'software'
  | 'robotics';

export interface Stage {
  id: StageId;
  /** 01 … 07 — порядковый маркер состояния */
  code: string;
  /** Короткая метка для навигации и прогресс-рейла */
  label: string;
  title: string;
  lead: string;
  body: string;
  tags: string[];
}

export const STAGES: Stage[] = [
  {
    id: 'hero',
    code: '01',
    label: 'CORE',
    title: 'ONE CORE',
    lead: 'Neovex',
    body:
      'Единая цифровая структура, из которой вырастают все направления компании. ' +
      'Одна сцена, один объект, одно непрерывное движение.',
    tags: ['AI', '3D', 'AR', 'VR', 'SOFTWARE', 'ROBOTICS'],
  },
  {
    id: 'ai',
    code: '02',
    label: 'AI',
    title: 'ARTIFICIAL INTELLIGENCE',
    lead: 'Направление 01',
    body:
      'Ядро оживает: плотность связей растёт, импульсы проходят по сети быстрее. ' +
      'Модели, данные и решения как единая нейронная активность.',
    tags: ['ML', 'COMPUTER VISION', 'LLM', 'DATA'],
  },
  {
    id: 'three-d',
    code: '03',
    label: '3D',
    title: '3D',
    lead: 'Направление 02',
    body:
      'Нейронная структура собирается в геометрию. Камера входит ближе и показывает ' +
      'глубину, объём и внутреннюю архитектуру модели.',
    tags: ['MODELING', 'RENDER', 'REALTIME', 'WEBGL'],
  },
  {
    id: 'ar',
    code: '04',
    label: 'AR',
    title: 'AUGMENTED REALITY',
    lead: 'Направление 03',
    body:
      'Поверх объёма ложатся виртуальные слои: маркеры, направляющие и цифровые ' +
      'информационные элементы, привязанные к реальной геометрии.',
    tags: ['MARKERS', 'TRACKING', 'OVERLAY', 'WEBAR'],
  },
  {
    id: 'vr',
    code: '05',
    label: 'VR',
    title: 'VIRTUAL REALITY',
    lead: 'Направление 04',
    body:
      'Камера уходит внутрь структуры. Объект перестаёт быть объектом и становится ' +
      'пространством вокруг наблюдателя.',
    tags: ['IMMERSION', 'SPATIAL', 'HEADSET', 'PRESENCE'],
  },
  {
    id: 'software',
    code: '06',
    label: 'SOFTWARE',
    title: 'SOFTWARE',
    lead: 'Направление 05',
    body:
      'Пространство перестраивается в систему: панели, потоки, состояния. ' +
      'Абстрактные UI-компоненты как продолжение той же структуры.',
    tags: ['WEB', 'MOBILE', 'PLATFORM', 'API'],
  },
  {
    id: 'robotics',
    code: '07',
    label: 'ROBOTICS',
    title: 'ROBOTICS',
    lead: 'Направление 06',
    body:
      'Интерфейс рассыпается на механические детали и собирается в машину. ' +
      'После этого сцена возвращается к исходной нейронной сфере.',
    tags: ['AUTOMATION', 'SENSORS', 'CONTROL', 'HARDWARE'],
  },
];

export const STAGE_COUNT = STAGES.length;
