import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Text from '@/components/ui/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { t } from '@/features/localization/translate';
import { homePalette, homeTravelStyles as s } from '../styles/homeTravelStyles';

// 홈 퍼스트 폴드에서 즉시 새 여행 생성으로 진입하는 콤팩트 시작 바를 렌더링한다.
export default function HomeJourneyStart({
  ready,
  onCreate,
  subtitle,
}: {
  ready: boolean;
  onCreate: () => void;
  onReceipts?: () => void;
  subtitle?: string;
}) {
  // 큰 글자 모드에서는 좌우 요소를 세로로 쌓아 320px 화면에서도 줄바꿈 잘림을 막는다.
  const large = useAppAccessibility().largeText;
  return (
    <View
      style={[
        s.compactCreateBar,
        large && { flexDirection: 'column', alignItems: 'stretch' },
      ]}
      testID="home-journey-start"
    >
      <View style={s.compactCreateLeft}>
        <View style={s.compactCreateIcon} accessible={false}>
          <Ionicons
            name="globe-outline"
            size={20}
            color={homePalette.coralDeep}
            accessible={false}
          />
        </View>
        <View style={s.compactCreateCopy}>
          <Text style={s.compactCreateTitle}>{t('어디로 떠나시나요?')}</Text>
          <Text style={s.compactCreateSub}>
            {subtitle || t('추천: 도쿄 3박 4일 일정 만들기')}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('새 여행 만들기')}
        style={({ pressed }) => [
          s.compactCreateBtn,
          pressed && { opacity: 0.88 },
        ]}
        onPress={() => {
          // 새 여행 생성 화면으로 즉시 이동한다.
          onCreate();
        }}
        disabled={!ready}
      >
        <Ionicons name="add" size={16} color="#FFFFFF" accessible={false} />
        <Text style={s.compactCreateBtnText} accessible={false}>
          {t('새 여행 시작')}
        </Text>
      </Pressable>
    </View>
  );
}
