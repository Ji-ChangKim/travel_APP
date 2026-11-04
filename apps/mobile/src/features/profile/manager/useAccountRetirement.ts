import { submitOnce } from '@/features/forms/submissionLock';
import { serverOptions } from '@/features/workspace/shared/manager/service';
import { authRevision, clearRevokedCloudSession } from '@/services/cloudAuth';
import { useTripStore } from '@/stores/useTripStore';
import { FoundationClientError, requestFoundation } from '@wherego/api-client';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { z } from 'zod';
const responseSchema = z.object({
  data: z.object({
    requestedAt: z.string().datetime(),
    purgeAfter: z.string().datetime(),
  }),
});
// 탈퇴 요청과 재인증의 상태를 관리하며 확인한 계정의 응답만 적용한다.
export function useAccountRetirement() {
  // 같은 화면에서 계정이 바뀌면 이전 확인 대상을 새 계정에 적용하지 않는다.
  const user = useTripStore((state) => {
    return state.currentUser;
  });

  const router = useRouter();

  const lock = useRef(false);

  const [busy, setBusy] = useState(false);

  const [confirming, setConfirming] = useState('');

  const [error, setError] = useState('');

  const [reauthenticate, setReauthenticate] = useState(false);

  const [completed, setCompleted] = useState('');

  const userId = user?.id || '';

  function retire(): void {
    // 확인한 계정과 현재 계정이 같을 때 한 번만 전송한다.
    if (!userId || confirming !== userId || busy || lock.current) return;
    setBusy(true);
    setError('');
    setConfirming('');
    const started = authRevision();
    submitOnce(lock, async () => {
      // 정상 인증과 서버의 최근 로그인 검사를 통과한 뒤에만 기기 세션을 비운다.
      const options = await serverOptions(userId);
      if (!options.accessToken || authRevision() !== started) return;
      const result = responseSchema.parse(
        await requestFoundation(options, '/account/retirement', {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        }),
      );
      if (
        authRevision() !== started ||
        useTripStore.getState().currentUser?.id !== userId
      )
        return;
      const cleared = await clearRevokedCloudSession(options.accessToken);
      // 인증 구독이 계정을 반영하므로 여기서 새 화면 계정을 직접 비우지 않는다.
      if (cleared && authRevision() === started + 1)
        setCompleted(result.data.purgeAfter);
    })
      ?.catch((failure: unknown) => {
        // 재인증과 연결 실패를 구분하고 성공하지 않은 요청을 탈퇴 완료로 표시하지 않는다.
        if (
          authRevision() !== started ||
          useTripStore.getState().currentUser?.id !== userId
        )
          return;
        const recent =
          failure instanceof FoundationClientError && failure.status === 403;
        setReauthenticate(recent);
        setError(
          recent
            ? '계정 보호를 위해 다시 로그인한 뒤 요청해 주세요.'
            : '요청 결과를 확인하지 못했어요. 다시 로그인해 계정 상태를 확인해 주세요.',
        );
      })
      .finally(() => {
        // 다음 요청도 중복 잠금의 수명을 따르게 한다.
        return setBusy(false);
      });
  }
  // 정상 로그아웃을 마친 뒤 같은 계정 관리 목적지로 재인증한다.
  function requestReauthentication(): void {
    // 기존 세션을 정상 종료한 뒤 실제 인증 화면에서 다시 확인한다.
    return void useTripStore
      .getState()
      .logout()
      .then(() => {
        // 재인증 후 같은 계정 관리 경로로 돌아온다.
        return router.replace({
          pathname: '/login',
          params: { next: 'account' },
        });
      })
      .catch(() => {
        // 로그아웃 실패를 재인증 성공으로 넘기지 않는다.
        return setError(
          '로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
        );
      });
  }
  return {
    user,
    router,
    userId,
    busy,
    confirming,
    error,
    reauthenticate,
    completed,
    setConfirming,
    retire,
    requestReauthentication,
  };
}
export type AccountRetirementController = ReturnType<
  typeof useAccountRetirement
>;
