import { t } from '@/features/localization/translate';
import Text from '@/components/AppText';

import { colors } from '@/constants/theme';

import { View } from 'react-native';

import { styles } from './hub/styles/workspaceStyles';
import type { RenderTripPlanningProps } from './tripPlanningViewTypes';
// 현재 작성 단계와 진행률만 표시하며 입력·저장은 변경하지 않는다.
export default function TripPlanningProgress({
  step,
  recording,
}: Pick<RenderTripPlanningProps, 'step' | 'recording'>) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.brandCoral,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.actionForeground,
              }}
            >
              {step === 'basics' ? '1' : '2'}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: colors.textSecondary,
              letterSpacing: 0.3,
            }}
          >
            {step === 'basics'
              ? t('STEP 01 / 02 · 여행지와 일정')
              : t('STEP 02 / 02 · 항공편 입력과 확인')}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.textSecondary,
          }}
        >
          {step === 'basics' ? '50%' : '100%'}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: step === 'basics' ? '50%' : '100%',
            height: '100%',
            backgroundColor: colors.brandCoral,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: colors.text,
          fontWeight: '600',
        }}
      >
        {step === 'basics'
          ? recording
            ? t('다녀온 여행의 도시와 기간을 선택해 주세요.')
            : t('떠나고 싶은 여행지와 일정을 선택해 주세요.')
          : t('예약한 항공편을 추가하고 여행 내용을 확인해 주세요.')}
      </Text>
    </View>
  );
}
