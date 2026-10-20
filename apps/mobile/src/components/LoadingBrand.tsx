import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { colors } from '@/constants/theme';

// 대기 화면마다 같은 실제 로고와 이미지 실패 대체를 표시한다.
export default function LoadingBrand() {
  // 로고 파일 실패가 준비 흐름을 막거나 빈 화면을 만들지 않게 한다.
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.slot}>
      {failed ? (
        <Text style={s.wordmark}>TripPrint</Text>
      ) : (
        <Image
          source={require('../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
          style={s.logo}
          resizeMode="contain"
          accessibilityLabel="TripPrint 트립프린트"
          onError={() => {
            // 같은 공간에 브랜드 글자로 대체한다.
            return setFailed(true);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  slot: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 164, height: 52 },
  wordmark: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.text,
  },
});
