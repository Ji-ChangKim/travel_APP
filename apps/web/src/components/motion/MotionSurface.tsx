'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useReadingProgress } from '@/shared/motion/useReadingProgress';
import { useReducedMotion } from '@/shared/motion/useReducedMotion';

const MotionContext = createContext({
  paused: false,
  reduced: false,
  toggle: () => {},
});

export function MotionControl() {
  const { paused, reduced, toggle } = useContext(MotionContext);
  if (reduced)
    return <p className="motion-control">움직임을 줄여 보고 있어요</p>;
  return (
    <button
      type="button"
      className="motion-control"
      aria-pressed={paused}
      onClick={toggle}
    >
      <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
      {paused ? '움직임 다시 보기' : '움직임 멈추기'}
    </button>
  );
}

export function MotionSurface({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduced = useReducedMotion();
  useReadingProgress(root);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.dataset.enhanced = 'true';
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!(entry.target instanceof HTMLElement)) continue;
                entry.target.dataset.active = String(entry.isIntersecting);
                if (entry.isIntersecting) entry.target.dataset.visible = 'true';
              }
            },
            { threshold: 0.08 },
          )
        : undefined;
    element.querySelectorAll('[data-scene]').forEach((scene) => {
      if (observer) observer.observe(scene);
      else if (scene instanceof HTMLElement) scene.dataset.visible = 'true';
    });
    element.dataset.observer = String(Boolean(observer));
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <MotionContext.Provider
      value={{ paused, reduced, toggle: () => setPaused((value) => !value) }}
    >
      <div
        ref={root}
        className="site"
        data-motion={paused || hidden || reduced ? 'paused' : 'playing'}
      >
        <div className="reading-progress" aria-hidden="true" />
        {children}
      </div>
    </MotionContext.Provider>
  );
}
