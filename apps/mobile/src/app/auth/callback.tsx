import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import ScreenHeader from '@/components/ScreenHeader';
import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HaruState from '@/components/HaruState';
import DesignButton from '@/components/DesignButton';
import CenteredNoticeModal from '@/components/CenteredNoticeModal';
import { styles } from '@/features/workspace/hub/styles/workspaceStyles';

import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  completeSocialAuth,
  socialRedirectUrl,
} from '@/features/auth/manager/oauth';
import {
  readSocialReturn,
  clearSocialReturn,
} from '@/features/auth/manager/socialReturn';
import type { AuthReturn } from '@/features/auth/model/authReturn';
import { authenticatedDestination } from '@/features/auth/model/destination';

// 웹 및 모바일 OAuth의 공통 복귀 화면을 제공한다.
export default function AuthCallbackScreen() {
  useLocale();
  // 인증 코드는 화면이나 로그에 출력하지 않는다.
  const { code, error, error_code, sb_flow_id } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    sb_flow_id?: string;
  }>();
  const router = useRouter();
  const [target, setTarget] = useState<AuthReturn>({});
  const [failed, setFailed] = useState(false);

  // 로그인 상태를 확인하고 원래 여행 화면으로 돌아간다.
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
    readSocialReturn()
      .then((params) => {
        // 실패 후 새 로그인을 시작할 때도 원래 목적을 보존한다.
        if (active) setTarget(params);
        return completeSocialAuth(callbackUrl).then(() => {
          // 신규 SNS 회원은 복귀 목적을 가진 개인정보 설정으로 이동한다.
          return authenticatedDestination(
            params.next,
            params.destination,
            params.tripId,
          );
        });
      })
      .then((destination) => {
        // 교환에 성공한 화면만 내 여행으로 이동한다.
        return active
          ? clearSocialReturn().then(() => {
              // 임시 목적을 지운 뒤 살아 있는 콜백 화면만 이동한다.
              return active ? router.replace(destination) : undefined;
            })
          : undefined;
      })
      .catch(() => {
        // 공급자 원문 대신 서비스의 안전한 메시지를 보여준다.
        if (active) {
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
      <ScreenHeader title={t('로그인 확인')} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, justifyContent: 'center' },
        ]}
      >
        <HaruState
          kind="loading"
          title={t('로그인하고 있어요')}
          description={t('확인이 끝나면 여행으로 안내할게요.')}
        />
      </ScrollView>
      <CenteredNoticeModal
        visible={failed}
        title={t('로그인 안내')}
        paragraphs={[t('로그인 정보가 만료됐거나 확인을 마치지 못했어요.'), t('다시 로그인하고 여행을 이어가요.')]}
        onClose={() => router.replace({ pathname: '/login', params: { ...target, reauth: '1' } })}
      >
            <DesignButton
              label={t('로그인으로 돌아가기')}
              variant="primary"
              onPress={() => {
                // 만료된 코드 재사용 대신 새 로그인을 시작한다.
                return router.replace({
                  pathname: '/login',
                  params: { ...target, reauth: '1' },
                });
              }}
            />
      </CenteredNoticeModal>
    </SafeAreaView>
  );
}
