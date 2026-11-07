import { useState } from 'react';
import { t } from '@/features/localization/translate';

import Text from '@/components/ui/AppText';

import type { WorkspaceSnapshot } from '@wherego/domain';

import { View } from 'react-native';

import {
  TripCostSummary,
  TripDetailEmpty,
  TripExpenseHeading,
} from '../../my-trips/ui/TripDetailParts';

import { tripDetailStyles as detail } from '../../my-trips/styles/tripDetailStyles';

import { Action } from '../../shared/ui/ui';

import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { styles } from '../styles/workspaceStyles';

type RenderWorkspaceExpensesProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
};

// 가계부 대시보드와 지출 항목 목록·수정·삭제 행동을 표시한다.
function WorkspaceExpensesContent({
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  actions,
}: Omit<RenderWorkspaceExpensesProps, 'activeSection'>) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const visibleExpenses =
    selectedCategory === 'all'
      ? snapshot.expenses
      : snapshot.expenses.filter(
          (item) => (item.category || 'etc') === selectedCategory,
        );

  return (
    <View testID="trip-expenses-panel" style={detail.section}>
      <Text style={detail.title}>{t('비용')}</Text>
      <TripCostSummary
        expenses={snapshot.expenses}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      {!visibleExpenses.length && (
        <TripDetailEmpty
          title={
            snapshot.expenses.length
              ? t('선택한 분류에 기록한 지출이 없어요')
              : t('아직 기록한 비용이 없어요')
          }
          description={
            writable
              ? t('비용 추가에서 방문한 장소와 사용한 금액을 남겨보세요.')
              : t('여행에서 남긴 비용을 여기서 함께 확인해요.')
          }
        />
      )}
      {visibleExpenses.map((item) => (
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
  );
}

// 실제 비용과 수정·삭제 행동을 표시한다.
export function renderWorkspaceExpenses(props: RenderWorkspaceExpensesProps) {
  return (
    props.activeSection === 'expenses' && (
      <WorkspaceExpensesContent {...props} />
    )
  );
}
