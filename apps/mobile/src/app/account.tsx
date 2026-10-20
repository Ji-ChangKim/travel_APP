import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { requestFoundation, FoundationClientError } from '@wherego/api-client';
import { z } from 'zod';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import ActionSheet from '@/components/ActionSheet';
import { Action } from '@/features/workspace/ui';
import { styles } from '@/features/workspace/workspaceStyles';

import { serverOptions } from '@/features/workspace/service';
import { useTripStore } from '@/stores/useTripStore';
import { clearRevokedCloudSession } from '@/services/cloudAuth';
import { submitOnce } from '@/features/forms/submissionLock';

const responseSchema = z.object({
  data: z.object({
    requestedAt: z.string().datetime(),
    purgeAfter: z.string().datetime(),
  }),
});

// 계정 관리 안에서 탈퇴 유예와 보존 범위를 확인하고 실제 요청한다.
export default function AccountScreen() {
  // 같은 화면에서 계정이 바뀌면 이전 확인 대상을 새 계정에 적용하지 않는다.
  const user = useTripStore((state) => {
    // 현재 인증된 계정만 탈퇴 대상으로 사용한다.
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
    submitOnce(lock, async () => {
      // 정상 인증과 서버의 최근 로그인 검사를 통과한 뒤에만 기기 세션을 비운다.
      const options = await serverOptions(userId);
      const result = responseSchema.parse(
        await requestFoundation(options, '/account/retirement', {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        }),
      );
      if (useTripStore.getState().currentUser?.id !== userId) return;
      setCompleted(result.data.purgeAfter);
      await clearRevokedCloudSession();
      useTripStore.getState().setCurrentUser(null);
    })
      ?.catch((failure: unknown) => {
        // 재인증과 연결 실패를 구분하고 성공하지 않은 요청을 탈퇴 완료로 표시하지 않는다.
        if (useTripStore.getState().currentUser?.id !== userId) return;
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
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="계정 관리"
        backLabel={user ? 'MY로 돌아가기' : '홈으로 돌아가기'}
        disabled={busy}
        onBack={() => {
          // 처리 중에는 계정 변경 요청을 중간에 다시 시작하지 않는다.
          return busy
            ? undefined
            : router.replace(user ? '/(tabs)/my' : '/(tabs)');
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {completed ? (
          <>
            <Text style={styles.title}>탈퇴 유예를 시작했어요</Text>
            <Text>
              {new Date(completed).toLocaleDateString('ko-KR')}에 계정 연결
              정보를 삭제해요. 90일 안에 다시 로그인하면 탈퇴가 취소되고 여행을
              다시 볼 수 있어요.
            </Text>
            <Action
              label="홈으로"
              variant="primary"
              onPress={() => {
                // 실제 탈퇴 요청 성공 뒤 공개 홈으로 이동한다.
                return router.replace('/(tabs)');
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>회원 탈퇴</Text>
            <Text>
              탈퇴를 요청하면 로그아웃되고, 여행에서는 ‘탈퇴 멤버’로 표시돼요.
            </Text>
            <Text>
              90일 안에 같은 계정으로 다시 로그인하면 탈퇴를 취소하고 여행을
              복구할 수 있어요. 90일이 지나면 이메일·로그인 연결·프로필을
              삭제해요.
            </Text>
            <Text>
              내가 만든 여행과 함께한 여행, 사진·영수증·공개본은 계정과 분리해
              보관해요. 혼자 만든 여행도 보관되며 동행자의 여행 접근과 기존
              권한은 유지돼요. 소유권을 다른 동행자에게 넘기지 않아요.
            </Text>
            {!user || user.authProvider === 'guest' ? (
              <>
                <Text>
                  {user
                    ? '기기에 보관한 게스트 여행은 회원 탈퇴로 삭제되지 않아요. 연결한 회원 계정을 관리하려면 해당 계정으로 로그인해 주세요.'
                    : 'TripPrint 계정으로 로그인한 뒤 탈퇴를 요청할 수 있어요.'}
                </Text>
                <Action
                  label="로그인하고 계정 관리"
                  variant="primary"
                  onPress={() => {
                    // 로그인 후 외부 주소 대신 고정된 계정 관리로 돌아온다.
                    return router.push({
                      pathname: '/login',
                      params: { next: 'account' },
                    });
                  }}
                />
              </>
            ) : (
              <Action
                label={busy ? '요청 중…' : '탈퇴 내용 확인'}
                variant="danger"
                loading={busy}
                onPress={() => {
                  // 보존 범위를 읽은 본인 계정으로 확인 대상을 고정한다.
                  return setConfirming(userId);
                }}
              />
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {reauthenticate && (
              <Action
                label="로그아웃하고 다시 확인"
                disabled={busy}
                onPress={() => {
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
                }}
              />
            )}
          </>
        )}
      </ScrollView>
      <ActionSheet
        variant="confirm"
        title="탈퇴 유예를 시작할까요?"
        visible={Boolean(confirming && confirming === userId)}
        onClose={() => {
          // 취소는 서버 상태와 계정 연결을 유지한다.
          return setConfirming('');
        }}
      >
        <Text>
          지금 로그아웃돼요. 90일 안에 다시 로그인하면 취소할 수 있어요.
          여행·사진·영수증과 공개본은 계정과 분리해 보관해요.
        </Text>
        <Action
          label="계속 이용하기"
          onPress={() => {
            // 안전한 선택은 원래 계정 화면으로 돌아간다.
            return setConfirming('');
          }}
        />
        <Action label="탈퇴 유예 시작" variant="destructive" onPress={retire} />
      </ActionSheet>
    </SafeAreaView>
  );
}
