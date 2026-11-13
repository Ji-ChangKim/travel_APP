'use client';

import { useEffect, type RefObject } from 'react';
import { scrollProgress } from './scrollProgress';

export function useReadingProgress(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      root.current?.style.setProperty(
        '--reading-progress',
        String(
          scrollProgress(
            window.scrollY,
            document.documentElement.scrollHeight - window.innerHeight,
          ),
        ),
      );
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [root]);
}
