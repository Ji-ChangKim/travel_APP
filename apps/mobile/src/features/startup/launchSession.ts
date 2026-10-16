import { create } from 'zustand';

// 프로세스 안에서만 00과 01의 완료를 기억하며 인증 복귀에 재생하지 않는다.
export const useLaunchSession = create<{
  biDone: boolean;
  introDone: boolean;
  nativeReady: boolean;
}>(() => {
  // 기기 저장·회원 계정과 무관한 현재 실행의 표시 상태다.
  return { biDone: false, introDone: false, nativeReady: false };
});

// BI 완료를 한 번 확정해 01의 점검을 허용한다.
export function completeBi(): void {
  // 재시도·늦은 디코더 종료로 00을 다시 열지 않는다.
  if (!useLaunchSession.getState().biDone)
    useLaunchSession.setState({ biDone: true });
}

// 로그인·외부 링크로 시작한 실행은 나중에 루트로 돌아와도 BI를 반복하지 않는다.
export function skipLaunchIntro(): void {
  // 콜백 화면의 실제 레이아웃 준비는 별도로 기다린다.
  useLaunchSession.setState({ biDone: true, introDone: true });
}

// 01 표시 완료는 현재 프로세스에서만 유지한다.
export function completeLoading(): void {
  // 재시도와 인증 복귀에서 로딩 연출을 다시 시작하지 않는다.
  if (!useLaunchSession.getState().introDone)
    useLaunchSession.setState({ introDone: true });
}

// 실제 프레임 또는 정적 화면이 준비된 뒤 기본 스플래시를 해제한다.
export function nativeFrameReady(): void {
  // 같은 이미지·영상의 중복 프레임은 상태를 다시 만들지 않는다.
  if (!useLaunchSession.getState().nativeReady)
    useLaunchSession.setState({ nativeReady: true });
}
