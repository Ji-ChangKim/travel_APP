import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

// 환영 섹션에 전달되는 속성을 정의한다.
interface Props {
  nickname?: string | null;
}

// 장식 배지 없이 사용자에게 한 줄 환영 제목을 표시한다.
export default function HomeWelcomeGreeting({ nickname }: Props) {
  // 긴 닉네임도 제목을 두 줄로 밀어내지 않도록 말줄임 처리한다.
  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.headline}
      >
        환영해요, {resolveDisplayName(nickname)}님! 👋
      </Text>
      <Text style={styles.subhead}>설레는 첫 여정을 함께 건너볼까요?</Text>
    </View>
  );
}

// 닉네임 유무에 따른 사용자 표시명을 결정한다.
function resolveDisplayName(nickname?: string | null): string {
  // 공백을 제외한 닉네임이 있으면 그대로 반환하고 없으면 '여행자'를 반환한다.
  return nickname?.trim() || '여행자';
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 4,
  },
  headline: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    fontWeight: '500',
  },
});
