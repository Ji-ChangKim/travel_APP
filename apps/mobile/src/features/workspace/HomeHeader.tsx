import Text from '@/components/AppText';
import { Image, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { homeStyles as s } from './homeStyles';

// 홈 헤더는 브랜드와 로그인만 표시하고 탐색은 하단 탭에 맡긴다.
export default function HomeHeader({
  signedIn,
  ready,
}: {
  signedIn: boolean;
  ready: boolean;
}) {
  // 중복 목적지를 가진 팝업 메뉴를 만들지 않는다.
  return (
    <View style={s.topBar}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel="TripPrint"
        style={s.brandHeader}
      >
        <View style={s.brandSymbolFrame}>
          <Image
            accessible={false}
            source={require('../../../assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png')}
            style={s.brandSymbol}
          />
        </View>
        <Text style={s.brandTitle}>
          Trip<Text style={s.brandAccent}>Print</Text>
        </Text>
      </View>
      <View style={s.topRightActions}>
        {!signedIn && ready && (
          <Link href="/login" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="로그인"
              style={s.login}
            >
              <Text style={s.linkText}>로그인</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </View>
  );
}
