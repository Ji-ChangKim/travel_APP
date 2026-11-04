import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { socialAvailability } from './oauth';
import LoginButton from './LoginButton';
import { loginStyles as styles } from './loginStyles';
import GoogleBrandButton from './GoogleBrandButton';

// 현재 제공하는 Google 로그인만 서버 상태에 맞춰 표시한다.
export default function GoogleLogin({
  busy,
  disabled,
  onPress,
  presentation = 'default',
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  presentation?: 'default' | 'welcome';
}) {
  useLocale();
  // 미등록 공급자를 실행하지 않고 조회 실패 시 재시도를 제공한다.
  const providers = useQuery({
    queryKey: ['social-providers'],
    queryFn: socialAvailability,
    retry: false,
  });
  // 공식 Google G 원본을 색상 변경 없이 사용한다.
  return (
    <View style={{ gap: 8 }}>
      <GoogleBrandButton
        disabled={disabled || busy || !providers.data?.google}
        busy={busy || providers.isFetching}
        onPress={onPress}
      />
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {t('Google 계정으로 로그인하고 있어요…')}
        </Text>
      ) : null}
      {!providers.isPending && !providers.data?.google ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {presentation === 'welcome'
            ? t(
                'Google 로그인을 지금 이용할 수 없어요. 다시 확인하거나 게스트로 시작해 주세요.',
              )
            : t('Google 로그인을 지금 이용할 수 없어요. 다시 확인해 주세요.')}
        </Text>
      ) : null}
      {!providers.isPending && !providers.data?.google ? (
        <LoginButton
          label={t('Google 로그인 다시 확인')}
          disabled={disabled || busy || providers.isFetching}
          onPress={() => {
            // Google 이용 가능 여부만 다시 조회한다.
            return void providers.refetch();
          }}
        />
      ) : null}
    </View>
  );
}
