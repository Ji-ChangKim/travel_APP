import { t } from '@/features/localization/translate';

import Text from '@/components/AppText';

import type { WorkspaceSnapshot } from '@wherego/domain';

import { View } from 'react-native';

import {
  TripCostSummary,
  TripDetailEmpty,
  TripExpenseHeading,
} from './TripDetailParts';

import { tripDetailStyles as detail } from './tripDetailStyles';

import { Action } from './ui';

import type { WorkspaceScreenActions } from './workspaceScreenActions';
import { styles } from './workspaceStyles';

type RenderWorkspaceExpensesProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
};

// 실제 비용과 수정·삭제 행동을 표시한다.
export function renderWorkspaceExpenses({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  actions,
}: RenderWorkspaceExpensesProps) {
  return (
    activeSection === 'expenses' && (
      <View testID="trip-expenses-panel" style={detail.section}>
        <Text style={detail.title}>{t('비용')}</Text>
        <TripCostSummary expenses={snapshot.expenses} />
        {!snapshot.expenses.length && (
          <TripDetailEmpty
            title={t('아직 기록한 비용이 없어요')}
            description={
              writable
                ? t('비용 추가에서 실제 지출이나 예상 비용을 남겨보세요.')
                : t('여행에서 남긴 비용을 여기서 함께 확인해요.')
            }
          />
        )}
        {snapshot.expenses.map((item) => (
          <View key={item.id} style={detail.card}>
            <TripExpenseHeading
              item={item}
              scheduleTitle={
                snapshot.itinerary.find((schedule) => {
                  /* 비용에 연결한 실제 일정만 찾는다. */ return (
                    schedule.id === item.scheduleId
                  );
                })?.title
              }
            />
            {item.source === 'manual' && (
              <View style={styles.row}>
                <Action
                  label={t('비용 수정')}
                  disabled={!writable || busy || scanning || hasPending}
                  onPress={() => actions.editExpense(item)}
                />
                <Action
                  variant="danger"
                  label={t('비용 삭제')}
                  disabled={!writable || busy || scanning || hasPending}
                  onPress={() => actions.deleteExpense(item)}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    )
  );
}
