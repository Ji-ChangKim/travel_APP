import Text from '@/components/AppText';
import {
  Component,
  Suspense,
  lazy,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import type { AppAccessibility } from '../accessibility/appAccessibility';
import { bundledBiVideo } from './biAsset';
import { nativeFrameReady } from './launchSession';
import { useBiMotion } from './useLaunchMotion';

const Video = lazy(() => {
  // 영상이 없거나 움직임을 줄인 경우 네이티브 재생 모듈을 실행하지 않는다.
  return import('./BiVideo');
});

// 모듈 누락도 시작을 막지 않고 같은 정적 대체로 연결한다.
class VideoBoundary extends Component<
  { children: ReactNode; failed: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    // 내부 네이티브 오류는 화면 문구로 전달하지 않는다.
    return { failed: true };
  }
  componentDidCatch(): void {
    // 현재 재생 수명만 실패로 처리한다.
    this.props.failed();
  }
  render(): ReactNode {
    // 실패한 모듈을 반복해서 불러오지 않는다.
    return this.state.failed ? null : this.props.children;
  }
}

// 00은 서버·계정 점검을 시작하지 않고 BI와 대체 화면만 표시한다.
export default function LaunchIntro({
  onComplete,
  settings,
}: {
  onComplete: () => void;
  settings: AppAccessibility;
}) {
  // 프레임 준비 전에는 기본 스플래시와 같은 정적 자산을 유지한다.
  const { state, timeline, opacity } = useBiMotion(bundledBiVideo, settings);
  const [posterReady, setPosterReady] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  useLayoutEffect(() => {
    // 실제 영상 프레임 또는 대체 화면 준비 뒤에만 OS 스플래시를 닫는다.
    if (state.frame || (state.phase === 'poster' && posterReady))
      nativeFrameReady();
    if (state.phase === 'done') onComplete();
  }, [state.frame, state.phase, posterReady, onComplete]);
  useLayoutEffect(() => {
    // OS 스플래시가 끝나기 전에 대체 이미지 시간을 소진하지 않는다.
    if (posterReady) timeline.posterReady();
  }, [posterReady, timeline]);
  const video =
    bundledBiVideo !== null &&
    settings.ready &&
    !state.restricted &&
    ['waiting', 'video', 'fade'].includes(state.phase) &&
    state.failure === undefined;
  return (
    <Animated.View
      testID="startup-bi"
      {...(Platform.OS === 'web'
        ? {
            dataSet: {
              biPhase: state.phase,
              biReady: String(posterReady || state.frame),
            },
          }
        : {})}
      accessibilityLabel="TripPrint 시작"
      style={[s.screen, { opacity }]}
    >
      {video && (
        <VideoBoundary failed={timeline.failed}>
          <Suspense fallback={null}>
            <Video
              source={bundledBiVideo!}
              timeline={timeline}
              foreground={settings.foreground}
            />
          </Suspense>
        </VideoBoundary>
      )}
      {!state.frame &&
        (posterFailed ? (
          <View
            key="fallback-wordmark"
            style={s.wordmark}
            onLayout={() => {
              // 이미지도 읽을 수 없으면 실제 배치된 브랜드 글자로 시작을 이어간다.
              setPosterReady(true);
            }}
          >
            <Text style={s.brand}>TripPrint</Text>
          </View>
        ) : (
          <View key="poster-image" style={s.wordmark}>
            <Image
              testID="startup-bi-poster"
              source={require('../../../assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png')}
              resizeMode="contain"
              style={s.icon}
              accessible={false}
              onLoad={() => {
                // 디코딩한 실제 대체 이미지가 준비되었음을 기록한다.
                setPosterReady(true);
              }}
              onError={() => {
                // 이미지 누락에도 흰 화면을 유지하지 않는다.
                setPosterFailed(true);
              }}
            />
          </View>
        ))}
    </Animated.View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  icon: { width: 240, height: 240 },
  wordmark: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '800' },
});
