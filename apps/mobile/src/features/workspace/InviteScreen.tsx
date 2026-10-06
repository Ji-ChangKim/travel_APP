import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { acceptServerInvite } from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from './service';
import {
  readInvite,
  pendingInvite,
  savePendingInvite,
  clearPendingInvite,
} from './invite';
import { workspaceError } from './WorkspaceScreen';
import { Action, Field, styles } from './ui';
// 받은 링크를 확인하고 로그인 계정으로 명시적으로 참여한다.
export default function InviteScreen() {
  // 수락 요청의 동일 키를 화면 재시도에서 유지한다.
  const requestKey = useRef(Crypto.randomUUID());
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const url = Linking.useURL();
  const user = useTripStore((state) => {
    // 사용자 ID는 Auth 세션에서 투영된 값만 사용한다.
    return state.currentUser;
  });
  // 수신 링크 또는 로그인 전 보관한 토큰을 복원한다.
  useEffect(() => {
    // 원문은 화면 입력 상태에만 유지한다.
    pendingInvite()
      .then((stored) => {
        // 들어온 링크는 유효할 때만 기본 입력으로 선택한다.
        if (url?.includes('#token=')) setValue(readInvite(url));
        else if (stored) setValue(stored);
      })
      .catch(() => {
        // 잘못된 링크에서도 직접 붙여넣기로 다시 진행할 수 있다.
        setError('초대 링크를 확인하고 다시 붙여넣어 주세요.');
      });
  }, [url]);
  // 초대 토큰을 저장한 뒤 인증 또는 참여를 이어간다.
  function accept(): void {
    // 중복 수락 요청을 방지한다.
    if (busy) return;
    setBusy(true);
    setError('');
    Promise.resolve()
      .then(() => {
        // 링크 형식 검사와 로그인 복귀 보관을 수행한다.
        return savePendingInvite(readInvite(value));
      })
      .then(() => {
        // 게스트에게 실제 계정 인증을 요구한다.
        if (!user || user.authProvider === 'guest') {
          // 초대를 잃지 않고 로그인 화면으로 이동한다.
          router.push('/login');
          return null;
        }
        // 인증 토큰과 동일 요청 키로 참여를 저장한다.
        return serverOptions(user.id).then((options) => {
          // 서버가 만료·취소·이미 사용된 링크를 검사한다.
          return acceptServerInvite(
            options,
            readInvite(value),
            requestKey.current,
          );
        });
      })
      .then((tripId) => {
        // 실제 참여가 확인된 뒤에만 대기 토큰을 제거한다.
        return tripId
          ? clearPendingInvite().then(() => {
              // 권한이 부여된 실제 여행을 연다.
              router.replace(`/trips/${tripId}`);
            })
          : undefined;
      })
      .catch((failure: unknown) => {
        // 실패에도 동일 토큰·요청 키를 보존한다.
        setError(workspaceError(failure));
      })
      .finally(() => {
        // 수락 실패 후 다시 시도할 수 있다.
        setBusy(false);
      });
  }
  // 초대는 자동 수락하지 않고 사용자 확인을 받는다.
  return (
    <SafeAreaView style={[styles.screen, styles.content]}>
      <Text style={styles.header}>여행 초대</Text>
      <Text style={styles.subtitle}>
        친구가 보낸 링크로 여행에 참여해 보세요. 함께 일정을 확인하고 여행을
        준비할 수 있어요.
      </Text>
      <Field
        label="초대 링크"
        value={value}
        onChange={(next) => {
          // 다른 링크 입력은 별도의 수락 요청으로 처리한다.
          if (!busy) {
            setValue(next);
            requestKey.current = Crypto.randomUUID();
          }
        }}
      />
      <Action
        label={
          busy
            ? '확인 중…'
            : user && user.authProvider !== 'guest'
              ? '초대 확인하고 참여'
              : '로그인하고 참여'
        }
        disabled={busy}
        onPress={accept}
      />
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Action
        label="내 여행으로"
        disabled={busy}
        onPress={() => {
          // 참여하지 않는 토큰은 명시적으로 폐기한다.
          void clearPendingInvite().then(() => {
            // 기본 여행 허브로 돌아간다.
            router.replace('/(tabs)');
          });
        }}
      />
    </SafeAreaView>
  );
}
