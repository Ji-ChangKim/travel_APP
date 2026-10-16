import { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { BiTimeline } from './launchTimeline';

// 앱에 포함된 승인 영상만 무음·contain으로 재생한다.
export default function BiVideo({
  source,
  timeline,
  foreground,
}: {
  source: number;
  timeline: BiTimeline;
  foreground: boolean;
}) {
  // 영상은 반복·백그라운드·오디오 집중을 사용하지 않는다.
  const player = useVideoPlayer(source, (current) => {
    // 첫 재생 전부터 음소거해 짧은 소리도 나오지 않는다.
    current.muted = true;
    current.volume = 0;
    current.loop = false;
    current.staysActiveInBackground = false;
    current.audioMixingMode = 'mixWithOthers';
  });
  useLayoutEffect(() => {
    // 준비 완료와 첫 프레임을 구분하고 실제 종료만 완료로 처리한다.
    const subscriptions = [
      player.addListener('statusChange', ({ status }) => {
        // 손상·디코딩 실패는 원본 오류를 사용자에게 표시하지 않는다.
        if (status === 'error') timeline.failed();
      }),
      player.addListener('sourceLoad', ({ duration }) => {
        // 길이 계약을 통과한 영상만 재생 구간으로 사용한다.
        timeline.loaded(duration);
      }),
      player.addListener('playToEnd', () => {
        // 중복·늦은 종료는 조정자가 무시한다.
        timeline.ended();
      }),
    ];
    if (player.status === 'error') timeline.failed();
    if (player.duration > 0) timeline.loaded(player.duration);
    return () => {
      // 이전 디코더가 새 화면으로 결과를 전달하지 않는다.
      subscriptions.forEach((subscription) => {
        // 현재 구독 하나만 해제한다.
        subscription.remove();
      });
      player.pause();
    };
  }, [player, timeline]);
  useLayoutEffect(() => {
    // 돌아오면 처음부터 재생하지 않고 현재 위치를 이어간다.
    if (foreground) player.play();
    else player.pause();
    return () => {
      // 앱 이탈과 해제에서 재생을 확실히 중단한다.
      player.pause();
    };
  }, [player, foreground]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        surfaceType="textureView"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        onFirstFrameRender={timeline.firstFrame}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
