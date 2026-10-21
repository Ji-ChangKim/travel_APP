import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import HaruState from '@/components/HaruState';
import { Action } from './ui';
import { useMyTripDetails } from './useMyTripDetails';
import { adaptWorkspaceSnapshotToTimeline } from './timelinePlanAdapters';
import PlanDetailTimelineView from './PlanDetailTimelineView';

// 실제 내 여행 DB 스냅샷을 조회해 확정 일정 타임라인으로 렌더링한다.
export default function MyTripPlanScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const userId = useTripStore((state) => state.currentUser?.id || '');

  // 실제 내 여행 DB 데이터를 조회한다.
  const query = useMyTripDetails(userId, id);

  // 로딩 상태를 표시한다.
  if (query.isPending) {
    return (
      <HaruState kind="loading" title="내 여행 일정을 불러오는 중이에요." />
    );
  }

  // 오류 상태를 처리한다.
  if (query.isError || !query.data) {
    return (
      <HaruState
        kind="error"
        title="여행을 불러오지 못했어요"
        description="연결 상태를 확인하거나 내 여행 목록으로 돌아가 보세요."
      >
        <Action
          label="다시 불러오기"
          loading={query.isFetching}
          onPress={() => query.refetch()}
        />
        <Action
          label="내 여행 목록으로 이동"
          variant="quiet"
          onPress={() => router.push('/plans')}
        />
      </HaruState>
    );
  }

  // 실제 DB 객체를 확정된 나의 계획 타임라인 모델로 변환한다.
  const timelineData = adaptWorkspaceSnapshotToTimeline(query.data);

  return (
    <PlanDetailTimelineView
      data={timelineData}
      onExecuteCta={() => {
        // 여행 상세 허브로 이동하여 확정된 여정을 확인한다.
        return router.push({
          pathname: '/trips/[id]',
          params: { id: query.data.trip.id },
        });
      }}
      onAddSchedule={() => {
        // 기존 일정 편집 화면으로 이동한다.
        return router.push({
          pathname: '/trips/[id]',
          params: { id: query.data.trip.id },
        });
      }}
      onAddTransport={() => {
        // 기존 일정 편집 화면으로 이동한다.
        return router.push({
          pathname: '/trips/[id]',
          params: { id: query.data.trip.id },
        });
      }}
    />
  );
}
