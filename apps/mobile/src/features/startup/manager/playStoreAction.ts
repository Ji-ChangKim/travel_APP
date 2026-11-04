// 출시 전에는 클릭 의도만 기록한다. 외부 이동·업데이트·통과 상태 변경은 실행하지 않는다.
export function logPlayStoreClick(): void {
  console.info('클릭 시 이동', { action: 'google-play-store' });
}
