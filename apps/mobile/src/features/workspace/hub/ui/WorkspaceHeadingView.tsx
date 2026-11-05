import { t } from '@/features/localization/translate';
import { getLocale } from '@/features/localization/localeState';
import { returnToScreen } from '@/components/navigation/navigationModel';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import ScreenTitle from '@/components/navigation/ScreenTitle';
import TripIcon from '@/components/icons/TripIcon';

import type { UseQueryResult } from '@tanstack/react-query';
import {
  tripToday,
  validTripDates,
  type WorkspaceSnapshot,
} from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Image, Pressable, View } from 'react-native';
import { guideForTrip } from '../../community/model/cityGuides';

import { requestScheduleExit } from '../../schedule/ui/scheduleExitGuard';
import { travelDateRange } from '../../planning/model/travelDateRange';

import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { tripHubStyles as hub } from '../styles/tripHubStyles';
import { tripPresentation } from '../../shared/model/tripLifecycle';
import { Action } from '../../shared/ui/ui';

type RenderWorkspaceSummaryProps = {
  snapshot: WorkspaceSnapshot;
  router: ImperativeRouter;
  owner?: boolean;
  busy?: boolean;
  scanning?: boolean;
  hasPending?: boolean;
  openDraft?: (kind: WorkspaceDraftKind) => void;
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

// 시작일과 종료일(YYYY-MM-DD)로 N박 M일 요약 문구를 계산한다.
function formatTripNightsDays(startDate: string, endDate: string): string {
  // 유효한 날짜 범위일 때만 박수와 일수를 함께 반환한다.
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  )
    return '';
  const totalDays = Math.max(
    1,
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1,
  );
  const nights = totalDays - 1;
  return nights > 0
    ? t('{p0}박 {p1}일', { p0: nights, p1: totalDays })
    : t('당일치기');
}

// 출발 전 여행은 D-Day와 준비 상태를 결합한 배지 문구를 생성한다.
function formatStatusBadgeLabel(
  snapshot: WorkspaceSnapshot,
  phase: string,
  reminder: string,
): string {
  // 예정된 여행은 D-N · 여행 준비 중 형식으로 직관적인 카운트다운을 제공한다.
  if (phase === 'PLANNED' && validTripDates(snapshot.trip)) {
    const today = tripToday(snapshot.trip.timezone || 'UTC');
    const diff = Math.round(
      (Date.parse(snapshot.trip.startDate) - Date.parse(today)) / 86400000,
    );
    if (diff > 0) {
      return `D-${diff} · ${t('여행 준비 중')}`;
    }
  }
  return reminder;
}

// 여행 제목·상태·목적지·기간·동행 요약을 상단 벤토 카드로 표시한다.
export function renderWorkspaceSummary({
  snapshot,
  router,
  owner,
  busy,
  scanning,
  hasPending,
  openDraft,
}: RenderWorkspaceSummaryProps) {
  const presentation = tripPresentation(snapshot.trip);
  const guide = guideForTrip(snapshot.trip.country, snapshot.trip.city);
  const startDay = shortWeekday(snapshot.trip.startDate);
  const endDay = shortWeekday(snapshot.trip.endDate);
  const weekdayHint = startDay && endDay ? ` (${startDay}~${endDay})` : '';
  const nightsDays = formatTripNightsDays(
    snapshot.trip.startDate,
    snapshot.trip.endDate,
  );
  const statusLabel = formatStatusBadgeLabel(
    snapshot,
    presentation.phase,
    presentation.reminder,
  );

  return (
    <View style={hub.tripHeader} testID="trip-overview-card">
      {['DRAFT', 'PLANNED', 'IN_PROGRESS'].includes(presentation.phase) && (
        <View style={hub.badgeRow}>
          <View style={hub.dateBadge} testID="trip-status-badge">
            <View style={hub.statusDot} aria-hidden />
            <Text style={hub.dateBadgeText}>{statusLabel}</Text>
          </View>
          {owner && openDraft ? (
            <Pressable
              testID="trip-overview-edit"
              accessibilityRole="button"
              accessibilityLabel={t('여행 기본 정보 수정')}
              disabled={Boolean(busy || scanning || hasPending)}
              onPress={() => {
                // 상단 요약 카드의 수정 버튼으로 여행 기본 정보 편집 시트를 연다.
                return openDraft('metadata');
              }}
              style={hub.editButton}
            >
              <Text style={hub.editButtonText}>{t('수정')}</Text>
              <TripIcon name="journal-outline" size={14} color={colors.muted} />
            </Pressable>
          ) : null}
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
                color={colors.brandCoral}
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
                {nightsDays ? ` · ${nightsDays}` : ''}
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
      <View style={hub.bottomBadgeRow}>
        <View style={hub.companionBadge} testID="trip-companion-badge">
          <TripIcon name="user-outline" size={14} color={colors.primary} />
          <Text style={hub.companionBadgeText}>
            {t('동행 {p0}명', { p0: Math.max(1, snapshot.members.length) })}
          </Text>
        </View>
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

// 일정 탭 상단에 왕복 항공편 등록 상태와 빠른 항공권 추가 카드를 표시한다.
export function renderWorkspaceFlightPrompt({
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  selectedDay,
  actions,
}: {
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  selectedDay: string;
  actions: WorkspaceScreenActions;
}) {
  const dayId =
    snapshot.days.find((day) => day.id === selectedDay)?.id ||
    snapshot.days[0]?.id ||
    '';
  const flights = snapshot.itinerary.filter((item) => {
    // 이동 유형 중 항공편 정보가 있거나 항공 키워드가 포함된 일정을 찾는다.
    return (
      item.type === 'TRANSPORT' &&
      Boolean(
        item.flight ||
        /항공|비행|공항|편명|ICN|GMP|NRT|HND|KIX|FUK/i.test(item.title),
      )
    );
  });
  const primaryFlight = flights[0];
  const flightSummary = primaryFlight
    ? [
        primaryFlight.flight?.number,
        primaryFlight.flight?.departure && primaryFlight.flight?.arrival
          ? `${primaryFlight.flight.departure} → ${primaryFlight.flight.arrival}`
          : '',
        primaryFlight.title,
      ]
        .filter(Boolean)
        .join(' · ')
    : t('등록된 왕복 항공권이 없어요');

  return (
    <View style={hub.flightCard} testID="trip-flight-card">
      <View style={hub.flightInfoLeft}>
        <View style={hub.flightIconWrap} aria-hidden>
          <TripIcon name="flight-outline" size={20} color={colors.primary} />
        </View>
        <View style={hub.flightTextCol}>
          <View style={hub.flightTitleRow}>
            <Text style={hub.flightTitle}>{t('항공편 정보')}</Text>
            <Text style={hub.flightStatusText}>
              {flights.length
                ? t(' · {p0}건 등록', { p0: flights.length })
                : t(' · 미등록')}
            </Text>
          </View>
          <Text style={hub.flightSubText} numberOfLines={1}>
            {flightSummary}
          </Text>
        </View>
      </View>
      {writable && (
        <Pressable
          testID="trip-flight-add"
          accessibilityRole="button"
          accessibilityLabel={t('항공권 추가')}
          disabled={busy || scanning || hasPending}
          onPress={() => {
            // 선택한 일차의 항공권 입력 초안을 연다.
            return actions.addFlightSchedule(dayId);
          }}
          style={hub.flightAddButton}
        >
          <TripIcon name="plus-outline" size={14} color={colors.brandCoral} />
          <Text style={hub.flightAddText}>{t('항공권 추가')}</Text>
        </Pressable>
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
