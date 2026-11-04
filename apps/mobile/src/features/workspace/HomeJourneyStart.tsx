import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { t } from '@/features/localization/translate';
import { homeTravelStyles as s } from './homeTravelStyles';

// 홈 상단에서 언제든 즉시 실행할 수 있는 핵심 액션을 2열 퀵 카드로 제공한다.
export default function HomeJourneyStart({
  ready,
  onCreate,
  onReceipts,
}: {
  ready: boolean;
  onCreate: () => void;
  onReceipts: () => void;
}) {
  const large = useAppAccessibility().largeText;
  return (
    <View
      style={[s.quickGrid, large && { flexDirection: 'column' }]}
      testID="home-journey-start"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('기록할 여행 선택')}
        style={({ pressed }) => [
          s.quickCard,
          { minHeight: 48 },
          pressed && { opacity: 0.85 },
        ]}
        onPress={onReceipts}
        disabled={!ready}
      >
        <View
          style={[s.quickIconWrap, { backgroundColor: colors.selectedSurface }]}
          accessible={false}
        >
          <Ionicons
            name="receipt-outline"
            size={20}
            color={colors.actionPrimary}
            accessible={false}
          />
        </View>
        <View style={{ minWidth: 0 }} accessible={false}>
          <Text style={s.quickTitle}>{t('영수증 등록')}</Text>
          <Text style={s.quickDesc}>{t('방문 장소·비용 정리')}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('새 여행 만들기')}
        style={({ pressed }) => [
          s.quickCard,
          { minHeight: 48 },
          pressed && { opacity: 0.85 },
        ]}
        onPress={onCreate}
        disabled={!ready}
      >
        <View
          style={[
            s.quickIconWrap,
            { backgroundColor: colors.brandCoral + '1A' },
          ]}
          accessible={false}
        >
          <Ionicons
            name="airplane-outline"
            size={20}
            color={colors.brandCoral}
            accessible={false}
          />
        </View>
        <View style={{ minWidth: 0 }} accessible={false}>
          <Text style={s.quickTitle}>{t('새 여행 만들기')}</Text>
          <Text style={s.quickDesc}>{t('날짜·여행지 추가')}</Text>
        </View>
      </Pressable>
    </View>
  );
}
