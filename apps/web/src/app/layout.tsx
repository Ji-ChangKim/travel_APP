import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { designVariables } from '@/shared/design-system/designVariables';
import './globals.css';

const koreanFont = localFont({
  src: [
    {
      path: '../../../mobile/assets/fonts/line-seed/line-seed-ko-regular.ttf',
      weight: '400',
    },
    {
      path: '../../../mobile/assets/fonts/line-seed/line-seed-ko-bold.ttf',
      weight: '600 800',
    },
  ],
  variable: '--font-korean',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TripPrint',
  description:
    '떠나는 순간부터 다시 꺼내 볼 이야기까지. 여행의 전후를 나만의 이야기로 이어가는 TripPrint.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={koreanFont.variable} style={designVariables}>
      <body>{children}</body>
    </html>
  );
}
