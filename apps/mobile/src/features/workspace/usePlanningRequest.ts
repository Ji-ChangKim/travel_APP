import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// 조회 수명·중복 실행·백그라운드 전환을 한 곳에서 관리한다.
export function usePlanningRequest<T>(message: string) {
  // 호출 화면은 계정·여행 버전·선택 조건을 key로 사용해 이전 결과를 폐기한다.
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    busy: boolean;
    error: string;
    result: T | null;
  }>({ busy: false, error: '', result: null });
  useEffect(() => {
    // 백그라운드에서 돌아오면 사용자가 새로 조회하게 한다.
    const listener = AppState.addEventListener('change', (next) => {
      // 종료한 화면의 늦은 결과가 다시 표시되지 않게 취소한다.
      if (next === 'active') return;
      active.current?.abort();
      active.current = null;
      setState({ busy: false, error: '', result: null });
    });
    return () => {
      // 화면 종료 시 리스너와 요청을 함께 정리한다.
      active.current?.abort();
      listener.remove();
    };
  }, []);
  async function run(loader: (signal: AbortSignal) => Promise<T>) {
    // 상태 갱신 전 연속 클릭도 같은 요청을 중복 실행하지 않는다.
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ busy: true, error: '', result: null });
    try {
      const result = await loader(controller.signal);
      if (!controller.signal.aborted)
        setState({ busy: false, error: '', result });
    } catch {
      if (!controller.signal.aborted)
        setState({ busy: false, error: message, result: null });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  return { ...state, run };
}
