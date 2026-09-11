import { StageSections } from '@/components/sections/StageSections';
import { SceneMount } from '@/components/scene/SceneMount';
import { EndCard } from '@/components/ui/EndCard';
import { Loader } from '@/components/ui/Loader';
import { Nav } from '@/components/ui/Nav';
import { ProgressRail } from '@/components/ui/ProgressRail';
import { ScrollDriver } from '@/components/ui/ScrollDriver';
import { ScrollHint } from '@/components/ui/ScrollHint';

export default function Page() {
  return (
    <main className="relative w-full">
      {/* Одна сцена на весь сайт — закреплена под контентом и живёт весь скролл */}
      <SceneMount />

      {/* Прокрутка страницы → прогресс timeline 3D-сцены */}
      <ScrollDriver />

      <Nav />
      <StageSections />
      <ProgressRail />
      <ScrollHint />
      <EndCard />
      <Loader />
    </main>
  );
}
