import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HaruState from '@/components/HaruState';
import { Action, styles } from '@/features/workspace/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { completeSocialAuth, socialRedirectUrl } from '@/features/auth/oauth';
import { pendingAuthDestination } from '@/features/workspace/mapsShare';

// 웹 및 모바일 OAuth의 공통 복귀 화면을 제공한다.
export default function AuthCallbackScreen() {
  // 인증 코드는 화면이나 로그에 출력하지 않는다.
  const { code, error, error_code, sb_flow_id } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    sb_flow_id?: string;
  }>();
  const router = useRouter();
  const [message, setMessage] = useState('로그인을 확인하고 있습니다.');
  const [failed, setFailed] = useState(false);

  // 콜백 코드를 실제 Supabase 세션으로 교환한다.
  useEffect(() => {
    // 언마운트한 콜백 화면은 네비게이션하지 않는다.
    let active = true;
    // 웹은 실제 주소를 검증하고 모바일은 라우터 파라미터를 사용한다.
    const callbackUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : `${socialRedirectUrl()}?${new URLSearchParams(
            Object.entries({ code, error, error_code, sb_flow_id }).filter(
              (entry): entry is [string, string] => {
                // 배열 파라미터와 정의되지 않은 값은 인증 입력에서 제외한다.
                return typeof entry[1] === 'string';
              },
            ),
          ).toString()}`;
    // 브라우저 처리와 겹치는 코드는 서비스에서 한 번만 교환한다.
    completeSocialAuth(callbackUrl)
      .then(pendingAuthDestination)
      .then((destination) => {
        // 교환에 성공한 화면만 내 여행으로 이동한다.
        if (active) router.replace(destination);
      })
      .catch((error: unknown) => {
        // 공급자 원문 대신 서비스의 안전한 메시지를 보여준다.
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : '로그인에 실패했습니다. 다시 시도해 주세요.',
          );
          setFailed(true);
        }
      });
    // 언마운트 이후의 완료 이벤트를 무시한다.
    return () => {
      // 이전 화면의 작업 완료 표시를 차단한다.
      active = false;
    };
  }, [code, error, error_code, sb_flow_id, router]);

  // 성공 대기와 인증 실패 복귀 동작을 구분한다.
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, justifyContent: 'center' },
        ]}
      >
        <HaruState
          kind={failed ? 'error' : 'loading'}
          title={failed ? '로그인을 마치지 못했어요' : message}
          description={failed ? message : '확인이 끝나면 여행으로 안내할게요.'}
        >
          {failed && (
            <Action
              label="로그인으로 돌아가기"
              variant="primary"
              onPress={() => {
                // 만료된 코드 재사용 대신 새 로그인을 시작한다.
                return router.replace('/login');
              }}
            />
          )}
        </HaruState>
      </ScrollView>
    </SafeAreaView>
  );
}
