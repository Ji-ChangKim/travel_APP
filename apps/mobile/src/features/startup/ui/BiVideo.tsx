import { useEffect, useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { BiTimeline } from '../model/launchTimeline';

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
  useEffect(() => {
    // 웹 VideoView가 플레이어에 연결된 뒤 재생해야 첫 프레임에서 멈추지 않는다.
    // 돌아오면 처음부터 재생하지 않고 현재 위치를 이어간다.
    if (foreground) player.play();
    else player.pause();
    // 화면 해제 시 중단은 위 layout 정리가 맡아 네이티브 객체 해제보다 먼저 실행한다.
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
        playsInline
        contentFit="contain"
        surfaceType="textureView"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        onFirstFrameRender={timeline.firstFrame}
        style={[StyleSheet.absoluteFill, styles.video]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 웹의 video는 상하좌우 0만으로 원본 크기가 줄지 않아 명시적으로 화면에 맞춘다.
  video: { width: '100%', height: '100%' },
});
