import Text from '@/components/AppText';
import { homeColors as colors } from './homeTheme';
import { StyleSheet, View } from 'react-native';

// 환영 섹션에 전달되는 속성을 정의한다.
interface Props {
  nickname?: string | null;
}

// 장식 배지 없이 사용자에게 한 줄 환영 제목을 표시한다.
export default function HomeWelcomeGreeting({ nickname }: Props) {
  // 닉네임과 큰 글꼴은 필요한 만큼 줄을 바꾸어 표시한다.
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.headline}>
        반가워요, {resolveDisplayName(nickname)}님! 👋
      </Text>
      <Text style={styles.subhead}>당신만의 여행 발자국을 남겨볼까요?</Text>
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
    gap: 4,
    paddingTop: 4,
  },
  headline: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    fontWeight: '500',
  },
});
