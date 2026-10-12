import { StyleSheet, Text, View } from 'react-native';

// 환영 섹션에 전달되는 속성을 정의한다.
interface Props {
  nickname?: string | null;
}

// 신규 회원 연동 후 탐험가 뱃지와 맞춤형 환영 문구를 렌더링한다.
export default function HomeWelcomeGreeting({ nickname }: Props) {
  // 닉네임이 없으면 '여행자'를 기본값으로 사용한다.
  const displayName = resolveDisplayName(nickname);

  // 상단 뱃지와 개인화 환영 메시지를 반환한다.
  return (
    <View style={styles.container}>
      <View style={styles.badgeRow}>
        <View style={styles.explorerBadge}>
          <Text style={styles.explorerBadgeText}>New explorer!</Text>
        </View>
        <Text style={styles.codeText}>TripPrint #001</Text>
      </View>

      <Text style={styles.headline}>환영해요, {displayName}님! 👋</Text>
      <Text style={styles.subhead}>설레는 첫 여정을 함께 건너볼까요?</Text>
    </View>
  );
}

// 닉네임 유무에 따른 사용자 표시명을 결정한다.
function resolveDisplayName(nickname?: string | null): string {
  // 공백을 제외한 닉네임이 있으면 그대로 반환하고 없으면 '여행자'를 반환한다.
  const trimmed = nickname?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '여행자';
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explorerBadge: {
    backgroundColor: '#E8F3FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  explorerBadgeText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  codeText: {
    color: '#8A9BA8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  headline: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: '#203247',
    letterSpacing: -0.6,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 21,
    color: '#697581',
    fontWeight: '500',
  },
});
