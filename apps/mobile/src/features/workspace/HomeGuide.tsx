import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { homeColors as colors } from './homeTheme';

// 사용 설명을 줄이고 영수증에서 방문·메뉴로 이어지는 관계를 보여준다.
export default function HomeGuide() {
  useLocale();
  const router = useRouter();
  return (
    <Pressable
      testID="home-guide"
      accessibilityRole="button"
      accessibilityLabel={`${t('영수증 한 장, 여행의 기록으로')}. ${t('영수증을 추가할 여행 선택')}`}
      onPress={() => router.push('/(tabs)/plans')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('영수증 한 장, 여행의 기록으로')}
        </Text>
        <Ionicons name="arrow-forward" size={20} color={colors.primary} />
      </View>
      <View style={styles.steps}>
        {(
          [
            ['receipt-outline', '영수증'],
            ['location-outline', '방문 일정'],
            ['restaurant-outline', '메뉴 기록'],
          ] as const
        ).map(([icon, label]) => (
          <View key={icon} style={styles.step}>
            <Ionicons name={icon} size={24} color={colors.primary} />
            <Text style={styles.label}>{t(label)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.description}>
        {t('장소와 메뉴를 확인하고 여행에 남겨요.')}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: {
    flexBasis: '28%',
    flexGrow: 1,
    padding: 8,
    gap: 8,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.canvas,
  },
  label: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
  },
  description: { fontSize: 14, lineHeight: 22, color: colors.muted },
  pressed: { opacity: 0.78 },
});
