import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import HeaderAction from '@/components/navigation/HeaderAction';
import DesignButton from '@/components/ui/DesignButton';
import { homeHeaderStyles as s } from './homeHeaderStyles';

// 공식 브랜드와 실제 계정 화면으로 이동하는 행동을 홈 헤더에 표시한다.
export default function HomeHeader({
  signedIn,
  ready,
  variant = 'home',
}: {
  signedIn: boolean;
  ready: boolean;
  variant?: 'home' | 'public-feed' | 'travel-home';
}) {
  useLocale();
  // 중복 목적지를 가진 팝업 메뉴를 만들지 않는다.
  const router = useRouter();
  return (
    <View
      testID={variant === 'public-feed' ? 'footprints-feed-header' : undefined}
      style={variant === 'public-feed' ? s.publicFeed : undefined}
    >
      <View testID="brand-header" style={s.topBar}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="TripPrint"
          style={s.brandHeader}
        >
          <View style={s.brandSymbolFrame}>
            <Image
              accessible={false}
              resizeMode="contain"
              source={require('../../../assets/brand/tripprint-v1/tripprint-app-icon-source.png')}
              style={s.brandSymbol}
            />
          </View>
          <Image
            accessible={false}
            resizeMode="contain"
            source={require('../../../assets/brand/tripprint-v1/tripprint-wordmark-en.png')}
            style={s.brandWordmark}
          />
        </View>
        <View style={s.topRightActions}>
          {signedIn && ready && variant !== 'travel-home' && (
            <HeaderAction
              icon="account"
              label={t('내 계정 보기')}
              disabled={!ready}
              onPress={() => {
                // 계정 탭은 기존 탐색 상태를 보존하며 연다.
                return router.navigate('/(tabs)/my');
              }}
            />
          )}
          {!signedIn && ready && variant !== 'travel-home' && (
            <DesignButton
              label={t('로그인')}
              variant="quiet"
              size="header"
              onPress={() => {
                // 로그인 선택 화면을 스택에 열어 복귀 경로를 보존한다.
                return router.push('/login');
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
