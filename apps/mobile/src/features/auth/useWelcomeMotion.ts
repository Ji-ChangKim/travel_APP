import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useLaunchSession } from '@/features/startup/launchSession';
import { welcomeMotionTime, welcomeMotionValue } from './welcomeMotion';

type MotionGeometry = {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  fontScale: number;
};

// 시작에서 넘어온 한 번의 로고 이동만 소유하며 인증·라우팅은 바꾸지 않는다.
export function useWelcomeMotion() {
  const [pending] = useState(
    () => useLaunchSession.getState().welcomeIntroPending,
  );
  const [done, setDone] = useState(!pending);
  const [geometry, setGeometry] = useState<MotionGeometry | null>(null);
  const [laidOut, setLaidOut] = useState(false);
  const [clock] = useState(() => new Animated.Value(0));
  const [source, setSource] = useState<View | null>(null);
  const [target, setTarget] = useState<View | null>(null);
  const settings = useAppAccessibility();
  const viewport = useWindowDimensions();

  useEffect(() => {
    if (pending) useLaunchSession.setState({ welcomeIntroPending: false });
  }, [pending]);

  useEffect(() => {
    if (!pending || done || !settings.ready) return;
    if (
      settings.reduceMotion ||
      settings.screenReader ||
      (geometry &&
        (geometry.width !== viewport.width ||
          geometry.height !== viewport.height ||
          geometry.fontScale !== settings.fontScale))
    ) {
      clock.stopAnimation(() => {
        clock.setValue(welcomeMotionTime.total);
        setDone(true);
      });
      return;
    }
    if (!geometry && laidOut && settings.foreground) {
      let active = true;
      source?.measureInWindow((sx, sy, sw, sh) => {
        target?.measureInWindow((tx, ty, tw, th) => {
          if (active && sw > 0 && tw > 0)
            setGeometry({
              x: tx + tw / 2 - sx - sw / 2,
              y: ty + th / 2 - sy - sh / 2,
              scale: tw / sw,
              width: viewport.width,
              height: viewport.height,
              fontScale: settings.fontScale,
            });
        });
      });
      return () => {
        active = false;
      };
    }
    if (!geometry || !settings.foreground) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    clock.stopAnimation((value) => {
      if (!active) return;
      animation = Animated.timing(clock, {
        toValue: welcomeMotionTime.total,
        duration: Math.max(0, welcomeMotionTime.total - value),
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      });
      animation.start(({ finished }) => {
        if (active && finished) setDone(true);
      });
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [
    pending,
    done,
    geometry,
    laidOut,
    settings.ready,
    settings.reduceMotion,
    settings.screenReader,
    settings.foreground,
    settings.fontScale,
    viewport.width,
    viewport.height,
    clock,
    source,
    target,
  ]);

  const entrance = (
    delay: number,
    distance = 24,
    duration: number = welcomeMotionTime.entrance,
  ) => ({
    opacity: done ? 1 : welcomeMotionValue(clock, delay, duration, 0, 1),
    transform: [
      {
        translateY: done
          ? 0
          : welcomeMotionValue(clock, delay, duration, distance, 0),
      },
    ],
  });
  return {
    done,
    pending,
    onSourceMount: setSource,
    onTargetMount: setTarget,
    onLayout: () => setLaidOut(true),
    symbolStyle: {
      transform: [
        {
          translateX: welcomeMotionValue(
            clock,
            0,
            welcomeMotionTime.logo,
            0,
            geometry?.x ?? 0,
          ),
        },
        {
          translateY: welcomeMotionValue(
            clock,
            0,
            welcomeMotionTime.logo,
            0,
            geometry?.y ?? 0,
          ),
        },
        {
          scale: welcomeMotionValue(
            clock,
            0,
            welcomeMotionTime.logo,
            1,
            geometry?.scale ?? 1,
          ),
        },
      ],
    },
    wordmarkStyle: entrance(welcomeMotionTime.wordmark, 12),
    googleStyle: entrance(welcomeMotionTime.google),
    guestStyle: entrance(welcomeMotionTime.guest),
    versionStyle: entrance(welcomeMotionTime.version, 12, 320),
  };
}
