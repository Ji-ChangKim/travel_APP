import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  disabled: boolean;
  onCreateTrip: () => void;
}

// 등록된 일정이 없는 신규 유저에게 하루 마스코트와 여행 생성 행동을 유도하는 히어로 카드를 렌더링한다.
export default function HomeEmptyHero({ disabled, onCreateTrip }: Props) {
  // 사용자가 여행 계획을 즉시 시작할 수 있도록 시각적 유도 카드를 반환한다.
  return (
    <View style={styles.card}>
      <View style={styles.topBadgeRow}>
        <View style={styles.passportBadge}>
          <Text style={styles.passportBadgeText}>✈️ Passport Ready</Text>
        </View>
      </View>

      <View style={styles.mascotCircle}>
        <Image
          source={require('../../../assets/brand/haru-v1/TripPrint_Haru_empty_1024x1536.png')}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel="여행 가방을 챙긴 하루 마스코트"
        />
      </View>

      <View style={styles.journeyTag}>
        <Text style={styles.journeyTagText}>🔖 첫 번째 여정</Text>
      </View>

      <Text style={styles.title}>아직 등록된 여행이 없어요</Text>

      <Text style={styles.description}>
        가고 싶은 여행지를 등록하면 일정 계획, 동선 추천, 명소 팁, 영수증 서랍
        정리까지 한 번에 채워드릴게요!
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="첫 여행 계획 만들기"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onCreateTrip}
        style={({ pressed }) => [
          styles.createButton,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
        <Text style={styles.createButtonText}>첫 여행 계획 만들기</Text>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </Pressable>

      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          ⏱️ 3분이면 나만의 템플릿 일정이 완성돼요
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8F5',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFE8DF',
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  topBadgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  passportBadge: {
    backgroundColor: '#FFEFE8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  passportBadgeText: {
    color: '#FF5C39',
    fontSize: 12,
    fontWeight: '700',
  },
  mascotCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FFEFE8',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E2D8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: -2,
  },
  journeyTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5B6D',
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    color: '#203247',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#697581',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  createButton: {
    width: '100%',
    minHeight: 54,
    backgroundColor: '#FF5C39',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 6,
    shadowColor: '#FF5C39',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
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
    fontSize: 12,
    lineHeight: 18,
    color: '#8A9BA8',
    fontWeight: '500',
  },
});
