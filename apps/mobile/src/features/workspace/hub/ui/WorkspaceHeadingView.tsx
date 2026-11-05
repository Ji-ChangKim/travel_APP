import { t } from '@/features/localization/translate';
import { getLocale } from '@/features/localization/localeState';
import { returnToScreen } from '@/components/navigation/navigationModel';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import ScreenTitle from '@/components/navigation/ScreenTitle';
import TripIcon from '@/components/icons/TripIcon';

import type { UseQueryResult } from '@tanstack/react-query';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Image, View } from 'react-native';
import { guideForTrip } from '../../community/model/cityGuides';

import { requestScheduleExit } from '../../schedule/ui/scheduleExitGuard';
import { travelDateRange } from '../../planning/model/travelDateRange';

import { tripHubStyles as hub } from '../styles/tripHubStyles';
import { tripPresentation } from '../../shared/model/tripLifecycle';
import { Action } from '../../shared/ui/ui';

type RenderWorkspaceSummaryProps = {
  snapshot: WorkspaceSnapshot;
  router: ImperativeRouter;
};

// 날짜 문자열(YYYY-MM-DD)에서 짧은 요일 이름을 추출한다.
function shortWeekday(date: string): string {
  // 현지 날짜가 기기 시간대에 밀리지 않도록 UTC 정오 기준으로 계산한다.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

// 여행 제목·상태·목적지·기간 요약을 상단 벤토 카드로 표시한다.
export function renderWorkspaceSummary({
  snapshot,
  router,
}: RenderWorkspaceSummaryProps) {
  const presentation = tripPresentation(snapshot.trip);
  const guide = guideForTrip(snapshot.trip.country, snapshot.trip.city);
  const startDay = shortWeekday(snapshot.trip.startDate);
  const endDay = shortWeekday(snapshot.trip.endDate);
  const weekdayHint = startDay && endDay ? ` (${startDay}~${endDay})` : '';

  return (
    <View style={hub.tripHeader} testID="trip-overview-card">
      {['DRAFT', 'PLANNED', 'IN_PROGRESS'].includes(presentation.phase) && (
        <View style={hub.badgeRow}>
          <View style={hub.dateBadge}>
            <Text style={hub.dateBadgeText}>{presentation.reminder}</Text>
          </View>
        </View>
      )}
      <View style={hub.titleRow}>
        <View style={hub.titleColumn}>
          <ScreenTitle grow>{snapshot.trip.title}</ScreenTitle>
          <View style={hub.metaInlineRow}>
            <View style={hub.metaItem}>
              <TripIcon
                name="map-pin-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={hub.meta}>
                {[snapshot.trip.country, snapshot.trip.city]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View style={hub.metaDot} aria-hidden />
            <View style={hub.metaItem}>
              <TripIcon
                name="calendar-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={hub.status}>
                {presentation.label} ·{' '}
                {travelDateRange(
                  snapshot.trip.startDate,
                  snapshot.trip.endDate,
                )}
                {weekdayHint}
              </Text>
            </View>
          </View>
        </View>
        {guide?.photo ? (
          <Image
            source={guide.photo}
            style={hub.thumbnail}
            testID="trip-overview-thumbnail"
            accessibilityLabel={t('{p0} 여행지 사진', {
              p0: snapshot.trip.city || snapshot.trip.country,
            })}
          />
        ) : (
          <View style={hub.thumbnail} testID="trip-overview-thumbnail">
            <TripIcon
              name="landmark-duotone"
              size={26}
              color={colors.primary}
            />
          </View>
        )}
      </View>
      {presentation.phase === 'COMPLETED' && (
        <Text style={hub.meta}>
          {t(
            '여행이 끝났어요. 남긴 일정과 사진, 비용을 기록에서 확인해 보세요.',
          )}
        </Text>
      )}
      {presentation.phase === 'COMPLETED' && (
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
  setActiveSection: Dispatch<SetStateAction<string>>;
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
  setActiveSection,
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
                label: t('공유'),
                onPress: () => {
                  // 상단 공유 버튼으로 공유 영역을 연다.
                  return setActiveSection('share');
                },
              },
              {
                icon: 'more',
                label: t('여행 더보기'),
                expanded: showTripMore,
                onPress: () => {
                  // 여행에 관련된 보조 행동만 메뉴로 연다.
                  return setShowTripMore(true);
                },
              },
              {
                icon: 'account',
                label: t('MY'),
                onPress: () => {
                  // 내 계정 화면으로 이동한다.
                  return router.push('/my');
                },
              },
            ]
            : undefined
        }
      />
    )
  );
}
