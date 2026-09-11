/**
 * Раздел 8 ТЗ: «При слабом устройстве предусмотреть оптимизацию количества
 * частиц и качества эффектов».
 *
 * Определяем тир один раз при загрузке и раздаём бюджеты сцене.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityBudget {
  tier: QualityTier;
  /** Количество частиц основного объекта */
  particles: number;
  /** Количество нейронных связей (отрезков) */
  links: number;
  /** Фоновая пыль */
  dust: number;
  /** Ограничение devicePixelRatio */
  dpr: [number, number];
  /** Включать ли постобработку (bloom / RGB-сдвиг / шум) */
  postprocessing: boolean;
  bloomIntensity: number;
  antialias: boolean;
}

const BUDGETS: Record<QualityTier, QualityBudget> = {
  low: {
    tier: 'low',
    particles: 2600,
    links: 900,
    dust: 700,
    dpr: [1, 1.25],
    postprocessing: false,
    bloomIntensity: 0,
    antialias: false,
  },
  medium: {
    tier: 'medium',
    particles: 5200,
    links: 2200,
    dust: 1400,
    dpr: [1, 1.6],
    postprocessing: true,
    bloomIntensity: 0.5,
    antialias: false,
  },
  high: {
    tier: 'high',
    particles: 9000,
    links: 4200,
    dust: 2400,
    dpr: [1, 2],
    postprocessing: true,
    bloomIntensity: 0.62,
    antialias: false,
  },
};

export function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const width = window.innerWidth;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) return 'low';

  // Телефоны и слабые планшеты
  if (coarse && width < 820) return cores >= 8 && memory >= 6 ? 'medium' : 'low';
  if (width < 820) return 'low';

  if (cores >= 8 && memory >= 8 && width >= 1280) return 'high';
  if (cores >= 4) return 'medium';
  return 'low';
}

export function getBudget(tier: QualityTier): QualityBudget {
  return BUDGETS[tier];
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
