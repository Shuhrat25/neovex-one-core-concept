import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';

import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NEOVEX — ONE CORE',
  description:
    'Интерактивный 3D-опыт Neovex: AI, 3D, AR, VR, software и robotics как разные состояния одной технологической системы.',
  applicationName: 'NEOVEX — ONE CORE',
  metadataBase: new URL('https://neovex.uz'),
  openGraph: {
    title: 'NEOVEX — ONE CORE',
    description:
      'Одна непрерывная 3D-сцена, которой управляет прокрутка: нейронная сфера проходит через шесть направлений компании.',
    type: 'website',
    locale: 'ru_RU',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
