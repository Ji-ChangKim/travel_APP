import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { View } from 'react-native';
import Text from '@/components/AppText';
import { styles } from './hub/styles/workspaceStyles';

import { periodBlockedMessage, type TripPeriodImpact } from './tripPeriod';

// 변경할 기간에서 빠지는 날짜와 보존할 기록을 저장 전에 안내한다.
export default function TripPeriodSummary({
  impact,
}: {
  impact: TripPeriodImpact | null;
}) {
  useLocale();
  // 기술 식별자 대신 실제 날짜와 사용자의 기록으로 변경 결과를 설명한다.
  return (
    <View
      style={styles.card}
      accessibilityLabel={t('기간 변경 영향')}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.title}>{t('기간을 바꾸면 이렇게 달라져요')}</Text>
      <Text style={styles.subtitle}>
        {t(
          '유지되는 날짜의 일정과 기록은 그대로 남아요. 새로 포함한 날짜에는 빈 일정이 생겨요.',
        )}
      </Text>
      {impact && (
        <>
          <Text>
            {t('제외할 날짜')}{' '}
            {
              impact.removed.filter((date) => {
                // 실제 DAY가 있던 날짜만 여행에서 제외되는 날짜 수에 넣는다.
                return date.dayId !== null;
              }).length
            }
            {t('일 · 새로 포함할 날짜')} {impact.addedDays}
            {t('일')}
          </Text>
          {impact.removed.map((date) => (
            <View key={date.date} style={{ gap: 4 }}>
              <Text style={styles.label}>
                {date.dayNumber ? `DAY ${date.dayNumber} · ` : ''}
                {date.date}
              </Text>
              <Text>
                {t('DAY 소개')} {date.dayPlans}
                {t('개 · 일정')} {date.schedules}
                {t('개 · 사진')} {date.photos}
                {t('개 · 비용')} {date.expenses}
                {t('개 · 영수증')} {date.receipts}
                {t('개')}
              </Text>
            </View>
          ))}
          {impact.blocked ? (
            <Text style={styles.error} accessibilityRole="alert">
              {periodBlockedMessage}
            </Text>
          ) : impact.removed.length > 0 ? (
            <Text>{t('기록이 없는 날짜만 여행에서 제외돼요.')}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
