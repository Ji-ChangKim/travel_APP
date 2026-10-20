import { colors } from '@/constants/theme';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import LoadingBrand from './LoadingBrand';
import LoadingIndicator from './LoadingIndicator';

// 시작·인증 준비 중에 로고와 간결한 실제 대기 안내를 표시한다.
export default function TripPrintLoading({
  message = '여행을 준비하고 있어요',
}: {
  message?: string;
}) {
  // 호출 화면의 메시지를 유지하며 가짜 완료 상태를 표시하지 않는다.
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <LoadingBrand />
        <LoadingIndicator />
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {message}
        </Text>
      </ScrollView>
    </View>
  );
}

// 휴대폰과 넓은 웹 화면에서 동일한 크기의 준비 안내를 제공한다.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  caption: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
});
