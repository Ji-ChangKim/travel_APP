import { create } from 'zustand';

// 인증 확인의 진행 상태만 공유하며 계정 자료와 토큰은 보관하지 않는다.
export const useAuthReady = create<{
  ready: boolean;
  startupReady: boolean;
  startupError: string | null;
}>(() => ({ ready: false, startupReady: false, startupError: null }));
