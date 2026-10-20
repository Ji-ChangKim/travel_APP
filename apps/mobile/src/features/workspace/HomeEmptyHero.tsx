import Text from '@/components/AppText';
import { Image, StyleSheet, View } from 'react-native';
import { LedgerAction } from './LedgerUI';
import { ledgerColors } from './ledgerTheme';

const colors = {
  surface: ledgerColors.surface,
  selectedSurface: ledgerColors.soft,
  border: ledgerColors.line,
  text: ledgerColors.ink,
  muted: ledgerColors.muted,
  primary: ledgerColors.accent,
  textLight: ledgerColors.surface,
};

interface Props {
  returning?: boolean;
  disabled: boolean;
  onCreateTrip: () => void;
}

// 등록된 일정이 없는 신규 유저에게 하루 마스코트와 여행 생성 행동을 유도하는 히어로 카드를 렌더링한다.
export default function HomeEmptyHero({
  disabled,
  onCreateTrip,
  returning = false,
}: Props) {
  // 사용자가 여행 계획을 즉시 시작할 수 있도록 시각적 유도 카드를 반환한다.
  return (
    <View style={styles.card}>
      <View style={styles.mascotCircle}>
        <Image
          source={require('../../../assets/brand/haru-v1/TripPrint_Haru_empty_1024x1536.png')}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel="여행 가방을 챙긴 하루 마스코트"
        />
      </View>

      <View style={styles.journeyTag}>
        <Text style={styles.journeyTagText}>
          {returning ? '다음 여정' : '첫 번째 여정'}
        </Text>
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {returning
          ? '새로운 여행을 준비해 볼까요?'
          : '아직 등록된 여행이 없어요'}
      </Text>

      <Text style={styles.description}>
        가고 싶은 도시와 날짜를 정해 보세요. 일정과 사진, 여행 중 쓴 비용을 한
        여행에 모아 기록할 수 있어요.
      </Text>

      <View style={{ alignSelf: 'stretch' }}>
        <LedgerAction
          label={returning ? '다음 여행 계획 만들기' : '첫 여행 계획 만들기'}
          primary
          disabled={disabled}
          onPress={onCreateTrip}
        />
      </View>

      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          항공편 없이도 여행을 만들고 날짜별로 일정을 추가할 수 있어요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  mascotCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.selectedSurface,
    borderWidth: 4,
    borderColor: colors.selectedSurface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: -4,
  },
  mascotImage: {
    width: 120,
    height: 120,
  },
  journeyTag: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: -2,
  },
  journeyTagText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  title: {
    width: '100%',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  createButton: {
    width: '100%',
    minHeight: 54,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
  },
  createButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    fontWeight: '500',
  },
});
