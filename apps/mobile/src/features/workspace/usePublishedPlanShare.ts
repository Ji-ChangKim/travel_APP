import { useEffect, useRef, useState } from 'react';
import { UserFacingError } from '../../services/userFacingError';
import { sharePublicPlan } from './publicPlanShare';

// 공개 링크 전달의 잠금·화면 수명·결과 안내를 관리한다.
export function usePublishedPlanShare(
  title: string,
  postId: string,
  disabled: boolean,
) {
  // 화면은 결과만 읽고 기기 공유와 비동기 상태를 직접 처리하지 않는다.
  const running = useRef(false);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    // 공개본이 바뀌면 상위 key로 컴포넌트와 요청 수명을 교체한다.
    active.current = true;
    return () => {
      // 닫힌 화면의 공유 결과를 새 화면에 적용하지 않는다.
      active.current = false;
    };
  }, []);
  async function send(): Promise<void> {
    // 렌더링 전 연타도 동기 참조로 차단한다.
    if (running.current || disabled) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await sharePublicPlan(title, postId);
      if (active.current && result === 'copied')
        setMessage('공유 링크를 복사했어요. 원하는 곳에 붙여넣어 보내세요.');
    } catch (error) {
      // 기기 공유 실패 때문에 원본을 다시 저장하도록 안내하지 않는다.
      if (active.current)
        setMessage(
          error instanceof UserFacingError
            ? error.message
            : '링크를 보내지 못했어요. 공개 화면은 그대로 있으니 다시 시도해 주세요.',
        );
    } finally {
      // 공유를 취소해도 저장한 공개본은 그대로 둔다.
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { busy, message, send };
}
