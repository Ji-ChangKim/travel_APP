import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { tripPhase } from '@/features/workspace/shared/model/tripLifecycle';
import { Action } from '@/features/workspace/shared/ui/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { PersistedTrip } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { styles } from '../styles/myAccountStyles';
// 실제 여행 목록의 조회 상태와 단계별 통계를 표시한다.
export function renderAccountStatistics({
  userId,
  serverTrips,
  router,
}: {
  userId: string;
  serverTrips: UseQueryResult<PersistedTrip[], Error>;
  router: ImperativeRouter;
}): import('react').ReactNode {
  return userId ? (
    <View style={styles.summaryBox}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('총 여행 목록 보기')}
        style={styles.summaryItem}
        onPress={() => router.push('/(tabs)/plans')}
      >
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess ? serverTrips.data.length : '—'}
        </Text>
        <Text style={styles.summaryText}>{t('총 여행')}</Text>
      </Pressable>
      <View style={styles.summaryDivider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('예정된 여행 목록 보기')}
        style={styles.summaryItem}
        onPress={() => router.push('/(tabs)/plans')}
      >
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess
            ? serverTrips.data.filter((trip) => {
                // 앞으로 떠날 여행만 예정 통계에 포함한다.
                return (
                  trip.status !== 'ARCHIVED' &&
                  ['PLANNED', 'DRAFT'].includes(tripPhase(trip))
                );
              }).length
            : '—'}
        </Text>
        <Text style={styles.summaryText}>{t('예정된 여행')}</Text>
      </Pressable>
      <View style={styles.summaryDivider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('완성된 발자국 보기')}
        style={styles.summaryItem}
        onPress={() => router.push('/my-footprints')}
      >
        <Text style={styles.summaryNum}>
          {serverTrips.isSuccess
            ? serverTrips.data.filter((trip) => {
                // 발자국 목록과 동일하게 완료 여행만 집계한다.
                return (
                  trip.status !== 'ARCHIVED' && tripPhase(trip) === 'COMPLETED'
                );
              }).length
            : '—'}
        </Text>
        <Text style={styles.summaryText}>{t('완성된 발자국')}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.card}>
      <Text style={styles.settingTitle}>{t('나의 여행을 한곳에')}</Text>
      <Text style={styles.settingDesc}>
        {t('로그인하면 여행 계획을 저장하고 친구와 함께 작성할 수 있어요.')}
      </Text>
      <Action
        label={t('로그인하기')}
        variant="primary"
        onPress={() => {
          // 실제 계정 인증 화면으로 이동한다.
          return router.push('/login');
        }}
      />
    </View>
  );
}
