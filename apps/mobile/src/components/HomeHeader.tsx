import Text from '@/components/AppText';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import HeaderAction from '@/components/HeaderAction';
import DesignButton from '@/components/DesignButton';
import { homeHeaderStyles as s } from './homeHeaderStyles';

// 공식 브랜드와 실제 계정 화면으로 이동하는 행동을 홈 헤더에 표시한다.
export default function HomeHeader({
  signedIn,
  ready,
  variant = 'home',
}: {
  signedIn: boolean;
  ready: boolean;
  variant?: 'home' | 'public-feed';
}) {
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
              source={require('../../assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png')}
              style={s.brandSymbol}
            />
          </View>
          <Text style={s.brandTitle}>
            Trip<Text style={s.brandAccent}>Print</Text>
          </Text>
        </View>
        <View style={s.topRightActions}>
          {signedIn && ready && (
            <HeaderAction
              icon="account"
              label="내 계정 보기"
              onPress={() => {
                // 계정 탭은 기존 탐색 상태를 보존하며 연다.
                return router.navigate('/(tabs)/my');
              }}
            />
          )}
          {!signedIn && ready && (
            <DesignButton
              label="로그인"
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
