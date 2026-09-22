import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';

// 앱과 웹에서 공통으로 보여 줄 프로젝트의 세 가지 방향을 정의한다.
const features = [
  {
    number: '01',
    title: '설레는 여행 계획',
    description: '가고 싶은 곳과 하고 싶은 일을 하나의 일정으로.',
  },
  {
    number: '02',
    title: '함께 나누는 일정',
    description: '동행자와 같은 계획을 보며 함께 준비하는 여행.',
  },
  {
    number: '03',
    title: '오래 남는 여행 기록',
    description: '다녀온 곳의 순간과 이야기를 차곡차곡.',
  },
] as const;

// 화면 너비에 맞춰 줄바꿈되는 소개 카드를 표시한다.
function FeatureCard({
  number,
  title,
  description,
}: (typeof features)[number]) {
  return (
    <View style={styles.card}>
      <Text style={styles.number}>{number}</Text>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {title}
      </Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}

// 여행 앱의 시작 화면을 모바일과 웹에서 동일하게 렌더링한다.
export default function HomeScreen() {
  const router = useRouter();

  // 메인 여행 플래너 탭으로 화면을 전환한다.
  const handleStart = () => {
    router.push('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.brand}>TRAVEL APP</Text>
          <View style={styles.intro}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>함께 만드는 여행</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {'떠나기 전의 설렘부터,\n돌아온 뒤의 추억까지.'}
            </Text>
            <Text style={styles.description}>
              여행을 계획하고, 동행자와 일정을 나누고, 소중한 순간을 기록하는
              공간.
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={handleStart}>
              <Text style={styles.startButtonText}>여행 시작하기</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cards}>
            {/* 각 소개 항목을 하나의 카드로 변환한다. */}
            {features.map((feature) => (
              <FeatureCard key={feature.number} {...feature} />
            ))}
          </View>
          <Text style={styles.footer}>우리의 다음 여행은 여기에서.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 좁은 휴대폰 화면과 넓은 웹 화면에서 읽기 편한 간격을 유지한다.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: 48 },
  brand: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  intro: { gap: 24, paddingTop: 24 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 50,
    fontWeight: '700',
  },
  description: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 28,
    maxWidth: 560,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  startButtonText: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  number: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  cardDescription: { color: colors.muted, fontSize: 15, lineHeight: 25 },
  footer: { color: colors.muted, fontSize: 13, lineHeight: 22 },
});
