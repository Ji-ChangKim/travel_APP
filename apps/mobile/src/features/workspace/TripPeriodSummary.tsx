import { View } from 'react-native';
import Text from '@/components/AppText';
import { styles } from './workspaceStyles';

import { periodBlockedMessage, type TripPeriodImpact } from './tripPeriod';

// 변경할 기간에서 빠지는 날짜와 보존할 기록을 저장 전에 안내한다.
export default function TripPeriodSummary({
  impact,
}: {
  impact: TripPeriodImpact | null;
}) {
  // 기술 식별자 대신 실제 날짜와 사용자의 기록으로 변경 결과를 설명한다.
  return (
    <View
      style={styles.card}
      accessibilityLabel="기간 변경 영향"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.title}>기간을 바꾸면 이렇게 달라져요</Text>
      <Text style={styles.subtitle}>
        유지되는 날짜의 일정과 기록은 그대로 남아요. 새로 포함한 날짜에는 빈
        일정이 생겨요.
      </Text>
      {impact && (
        <>
          <Text>
            제외할 날짜{' '}
            {
              impact.removed.filter((date) => {
                // 실제 DAY가 있던 날짜만 여행에서 제외되는 날짜 수에 넣는다.
                return date.dayId !== null;
              }).length
            }
            일 · 새로 포함할 날짜 {impact.addedDays}일
          </Text>
          {impact.removed.map((date) => (
            <View key={date.date} style={{ gap: 4 }}>
              <Text style={styles.label}>
                {date.dayNumber ? `DAY ${date.dayNumber} · ` : ''}
                {date.date}
              </Text>
              <Text>
                DAY 소개 {date.dayPlans}개 · 일정 {date.schedules}개 · 사진{' '}
                {date.photos}개 · 비용 {date.expenses}개 · 영수증{' '}
                {date.receipts}개
              </Text>
            </View>
          ))}
          {impact.blocked ? (
            <Text style={styles.error} accessibilityRole="alert">
              {periodBlockedMessage}
            </Text>
          ) : impact.removed.length > 0 ? (
            <Text>기록이 없는 날짜만 여행에서 제외돼요.</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
