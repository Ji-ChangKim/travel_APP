import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

// 같은 브랜드 자산을 사용해 재사용 가능한 준비 중 화면 하나를 표시한다.
export default function TripPrintLoading({
  message = '여행을 준비하고 있어요',
}: {
  message?: string;
}) {
  // 가짜 진행률이나 완료 상태를 만들지 않고 현재 로딩 메시지만 표시한다.
  return (
    <View style={styles.screen}>
      <Image
        source={require('../../assets/brand/tripprint-v1/TripPrint_logo-stacked_768x768.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TripPrint 트립프린트"
      />
      <ActivityIndicator
        color="#C84432"
        size="small"
        accessibilityLabel="준비 중"
      />
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {message}
      </Text>
    </View>
  );
}

// 시작 화면과 광고 컨셉의 아이보리·네이비 색상을 함께 사용한다.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F3',
    padding: 24,
    gap: 20,
  },
  logo: { width: 280, height: 280 },
  message: {
    color: '#203247',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
