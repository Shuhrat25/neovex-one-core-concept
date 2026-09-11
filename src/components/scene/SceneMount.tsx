'use client';

import dynamic from 'next/dynamic';

/**
 * Точка монтирования WebGL-сцены.
 *
 * Канвас грузится только в браузере: на сервере нет GPU, а серверный рендер
 * three.js лишь удлиняет первый ответ. Отдельный клиентский модуль нужен
 * потому, что ssr: false недоступен внутри серверного компонента.
 */
const SceneCanvas = dynamic(
  () => import('./SceneCanvas').then((mod) => mod.SceneCanvas),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 z-0 bg-black" aria-hidden />,
  },
);

export function SceneMount() {
  return <SceneCanvas />;
}
