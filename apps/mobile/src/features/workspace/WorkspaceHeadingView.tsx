import { t } from '@/features/localization/translate';
import { returnToScreen } from '@/components/navigationModel';
import Text from '@/components/AppText';

import ScreenHeader from '@/components/ScreenHeader';
import ScreenTitle from '@/components/ScreenTitle';
import TripIcon from '@/components/icons/TripIcon';

import type { UseQueryResult } from '@tanstack/react-query';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';

import { memberRoleLabel } from './presentation';
import { requestScheduleExit } from './scheduleExitGuard';
import { travelDateRange } from './travelDateRange';

import { tripHubStyles as hub } from './tripHubStyles';
import { tripPresentation } from './tripLifecycle';
import { Action } from './ui';

type RenderWorkspaceSummaryProps = {
  snapshot: WorkspaceSnapshot;
  router: ImperativeRouter;
};

// 여행 제목·상태·동행 요약을 표시한다.
export function renderWorkspaceSummary({
  snapshot,
  router,
}: RenderWorkspaceSummaryProps) {
  return (
    <View style={hub.tripHeader}>
      <View style={hub.titleRow}>
        <ScreenTitle grow>{snapshot.trip.title}</ScreenTitle>
      </View>
      <Text style={hub.status}>
        {tripPresentation(snapshot.trip).label} ·{' '}
        {travelDateRange(snapshot.trip.startDate, snapshot.trip.endDate)}
      </Text>
      {tripPresentation(snapshot.trip).phase === 'COMPLETED' && (
        <Text style={hub.meta}>
          {t(
            '여행이 끝났어요. 남긴 일정과 사진, 비용을 기록에서 확인해 보세요.',
          )}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <TripIcon name="user-outline" size={16} />
        <Text style={hub.meta}>
          {snapshot.trip.city || snapshot.trip.country} {t('· 함께하는 멤버')}{' '}
          {snapshot.members.length}
          {t('명 ·')} {memberRoleLabel(snapshot.myRole)}
        </Text>
      </View>
      {tripPresentation(snapshot.trip).phase === 'COMPLETED' && (
        <Action
          label={t('기록 보러가기')}
          onPress={() => {
            // 종료된 여행의 일정·사진·비용을 날짜별로 읽는다.
            return router.push(`/diary/${snapshot.trip.id}`);
          }}
        />
      )}
    </View>
  );
}

type RenderWorkspaceHeaderProps = {
  id: string | undefined;
  router: ImperativeRouter;
  snapshot: WorkspaceSnapshot | undefined;
  workspace: UseQueryResult<WorkspaceSnapshot, Error>;
  showTripMore: boolean;
  setShowTripMore: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  confirmation: unknown;
  draftSaving: boolean;
};

// 실제 여행의 공통 이동 헤더를 표시한다.
export function renderWorkspaceHeader({
  id,
  router,
  snapshot,
  workspace,
  showTripMore,
  setShowTripMore,
  busy,
  scanning,
  hasPending,
  confirmation,
  draftSaving,
}: RenderWorkspaceHeaderProps): import('react').ReactNode {
  return (
    id && (
      <ScreenHeader
        backLabel={t('내 여행 목록')}
        disabled={
          busy || scanning || hasPending || Boolean(confirmation) || draftSaving
        }
        onBack={() => {
          /* 작성 중인 내용과 대기 요청을 확인한 뒤 목록으로 돌아간다. */ return requestScheduleExit(
            () => {
              /* 기존 목록 경로를 연다. */ return returnToScreen(
                router,
                '/plans',
              );
            },
          );
        }}
        actions={
          snapshot && !workspace.isError
            ? [
                {
                  icon: 'more',
                  label: t('여행 더보기'),
                  expanded: showTripMore,
                  onPress: () => {
                    // 여행에 관련된 보조 행동만 메뉴로 연다.
                    return setShowTripMore(true);
                  },
                },
              ]
            : undefined
        }
      />
    )
  );
}
