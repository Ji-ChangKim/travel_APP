import { subscribeCloud } from '@/services/cloudAuth';
import { clearLegacyDbCode } from '@/services/legacyStorage';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { clearAccountQueries } from './authQueryCache';
import {
  applyAuthSession,
  restoreAuthSession,
  restoreStartupAuth,
} from './authSessionRestore';

// 기존 화면의 import 경로를 유지하면서 상태와 복원 로직은 각각의 모듈이 소유한다.
export { clearAccountQueries } from './authQueryCache';
export { useAuthReady } from './authReadiness';
export { restoreStartupAuth } from './authSessionRestore';

// 앱이 열린 동안의 인증·전경 이벤트 구독만 연결하고 화면은 표시하지 않는다.
export default function AuthBridge() {
  const client = useQueryClient();
  useEffect(
    () => connectAuth(clearAccountQueries.bind(null, client)),
    [client],
  );
  return null;
}

// 구독을 먼저 설치한 뒤 최초 복원을 시작해 초기 인증 이벤트도 놓치지 않는다.
function connectAuth(clear: () => void): () => void {
  const unsubscribe = subscribeCloud(applyAuthSession.bind(null, clear));
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void restoreAuthSession(clear);
  });
  void clearLegacyDbCode().catch(() => {
    // 이전 저장소 정리에 실패해도 인증 복원은 진행하고 다음 시작 때 다시 시도한다.
    return undefined;
  });
  void restoreStartupAuth(clear);
  return () => {
    unsubscribe();
    appState.remove();
  };
}
