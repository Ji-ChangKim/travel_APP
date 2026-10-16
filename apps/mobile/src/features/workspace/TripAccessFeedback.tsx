import { useRouter } from 'expo-router';
import HaruState from '@/components/HaruState';
import { tripAccessFailure, type AuthReturn } from '../auth/authReturn';
import { requestScheduleExit } from './scheduleExitGuard';
import { Action } from './ui';

// 여행 조회 실패 원인에 맞춰 재인증·목록·재시도 행동을 제공한다.
export default function TripAccessFeedback({
  error,
  target,
  onRetry,
  busy = false,
}: {
  error: unknown;
  target: AuthReturn;
  onRetry: () => void;
  busy?: boolean;
}) {
  // 로그인으로 보내기 전에 기존 입력·미확정 요청 보호를 확인한다.
  const router = useRouter();
  const failure = tripAccessFailure(error);
  // 권한 부족과 삭제된 여행에서는 재로그인을 요구하지 않는다.
  return (
    <HaruState
      kind="error"
      title={
        failure === 'login'
          ? '로그인을 다시 확인해 주세요'
          : failure === 'list'
            ? '이 여행을 열 수 없어요'
            : '여행을 불러오지 못했어요'
      }
      description={
        failure === 'login'
          ? '다시 로그인하면 보고 있던 여행으로 돌아와요.'
          : failure === 'list'
            ? '참여 권한이 없거나 삭제된 여행이에요. 내 여행에서 다른 여행을 선택해 주세요.'
            : '연결을 확인하고 다시 시도해 주세요.'
      }
    >
      {failure === 'login' ? (
        <Action
          label="로그인하고 이어가기"
          onPress={() => {
            // 작성 중인 내용이 있으면 기존 이탈 확인을 거친다.
            return requestScheduleExit(() => {
              // 실제 로그인 화면에 검증할 복귀 목적만 넘긴다.
              return router.push({
                pathname: '/login',
                params: { ...target, reauth: '1' },
              });
            });
          }}
        />
      ) : failure === 'list' ? (
        <Action
          label={
            target.next === 'plans' ? '홈으로 돌아가기' : '내 여행 목록으로'
          }
          onPress={() => {
            // 현재 목록 자체의 권한 오류는 홈에서 다시 시작한다.
            return requestScheduleExit(() => {
              // 읽을 수 없는 상세 화면을 목록 또는 홈으로 교체한다.
              return router.replace(
                target.next === 'plans' ? '/(tabs)' : '/plans',
              );
            });
          }}
        />
      ) : (
        <Action label="여행 다시 불러오기" disabled={busy} onPress={onRetry} />
      )}
    </HaruState>
  );
}
