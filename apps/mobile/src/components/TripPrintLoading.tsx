import { Image, StyleSheet, View } from 'react-native';
import HaruState from './HaruState';

// 시작·인증 준비 중에 브랜드와 하루의 실제 대기 안내를 표시한다.
export default function TripPrintLoading({
  message = '여행을 준비하고 있어요',
}: {
  message?: string;
}) {
  // 호출 화면의 메시지를 유지하며 가짜 완료 상태를 표시하지 않는다.
  return (
    <View style={styles.screen}>
      <Image
        source={require('../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TripPrint 트립프린트"
      />
      <HaruState
        kind="loading"
        title={message}
        description="잠시만 기다려 주세요."
      />
    </View>
  );
}

// 휴대폰과 넓은 웹 화면에서 동일한 크기의 준비 안내를 제공한다.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F3',
    padding: 24,
    gap: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logo: { width: 164, height: 52 },
});
