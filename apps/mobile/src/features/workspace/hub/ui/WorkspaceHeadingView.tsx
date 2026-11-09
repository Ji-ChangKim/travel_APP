import { t } from '@/features/localization/translate';
import { returnToScreen } from '@/components/navigation/navigationModel';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import ScreenTitle from '@/components/navigation/ScreenTitle';
import TripIcon from '@/components/icons/TripIcon';

import type { UseQueryResult } from '@tanstack/react-query';
import { validTripDates, type WorkspaceSnapshot } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Pressable, View } from 'react-native';

import { requestScheduleExit } from '../../schedule/ui/scheduleExitGuard';

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
  setActiveSection?: Dispatch<SetStateAction<string>>;
};

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

// 히어로 요약 영역의 일정 기간 문구(일정 05.15 ~ 05.19 (4박 5일) / 연도 변경 / 일정 미정)를 조합한다.
function formatTripSchedulePillLabel(snapshot: WorkspaceSnapshot): string {
  // 날짜가 확정된 경우 동일 연도는 MM.DD, 해가 바뀌면 YY.MM.DD 형식으로 표기한다.
  if (validTripDates(snapshot.trip)) {
    const { startDate, endDate } = snapshot.trip;
    const crossYear = startDate.slice(0, 4) !== endDate.slice(0, 4);
    const fmt = (d: string) =>
      crossYear
        ? `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`
        : `${d.slice(5, 7)}.${d.slice(8, 10)}`;
    const dateRange =
      startDate === endDate
        ? fmt(startDate)
        : `${fmt(startDate)} ~ ${fmt(endDate)}`;
    const nightsDays = formatTripNightsDays(startDate, endDate);
    return nightsDays
      ? `${t('일정')} ${dateRange} (${nightsDays})`
      : `${t('일정')} ${dateRange}`;
  }
  const dayCount = Math.max(1, snapshot.days.length);
  const duration =
    dayCount > 1
      ? t('{p0}박 {p1}일', { p0: dayCount - 1, p1: dayCount })
      : t('당일치기');
  return `${t('일정')} (${duration})`;
}

// 04_1 히어로 요약(1행: 여행 제목 + 우측 지도 버튼 / 2행: 좌측 동행 아바타 그룹 + [+] | 우측 일정 기간)을 표시한다.
export function renderWorkspaceSummary({
  snapshot,
  router,
  owner,
  busy,
  scanning,
  hasPending,
  openDraft,
  setActiveSection,
}: RenderWorkspaceSummaryProps) {
  const presentation = tripPresentation(snapshot.trip);
  const scheduleLabel = formatTripSchedulePillLabel(snapshot);
  const locked = Boolean(busy || scanning || hasPending);
  const visibleMembers = snapshot.members.slice(0, 3);

  return (
    <View style={hub.tripHeader} testID="trip-overview-card">
      <View style={hub.summaryTitleRow}>
        <ScreenTitle grow>{snapshot.trip.title}</ScreenTitle>
        <View style={hub.summaryTitleRight}>
          {owner && openDraft ? (
            <Pressable
              testID="trip-overview-edit"
              accessibilityRole="button"
              accessibilityLabel={t('여행 기본 정보 수정')}
              disabled={locked}
              onPress={() => {
                // 여행 타이틀 우측의 수정 버튼으로 기본 정보 편집 시트를 연다.
                return openDraft('metadata');
              }}
              style={hub.editButton}
            >
              <TripIcon name="journal-outline" size={14} color={colors.muted} />
              <Text style={hub.editButtonText}>{t('수정')}</Text>
            </Pressable>
          ) : null}
          {setActiveSection ? (
            <Pressable
              testID="trip-hero-map-btn"
              accessibilityRole="button"
              accessibilityLabel={t('동선 지도 보기')}
              disabled={locked}
              onPress={() => {
                // 우측 상단 지도 아이콘 버튼으로 동선 지도 영역을 즉시 연다.
                setActiveSection('map');
              }}
              style={hub.heroMapIconBtn}
            >
              <TripIcon
                name="map-outline"
                size={18}
                color={colors.brandCoral}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={hub.summaryBottomRow}>
        <Pressable
          testID="trip-companion-badge"
          accessibilityRole="button"
          accessibilityLabel={t('동행 관리 ({p0})', {
            p0: t('동행 {p0}명', {
              p0: Math.max(1, snapshot.members.length),
            }),
          })}
          disabled={locked || !setActiveSection}
          onPress={() => {
            // 좌측 동행 아바타 스택 및 [+] 버튼을 눌러 동행 초대/관리 화면을 연다.
            setActiveSection?.('companions');
          }}
          style={hub.avatarStackRow}
        >
          {(visibleMembers.length
            ? visibleMembers
            : [{ memberId: 'me', nickname: t('나') }]
          ).map((member, index) => (
            <View
              key={member.memberId}
              style={[hub.avatarCircle, index > 0 && hub.avatarOverlap]}
            >
              <Text style={hub.avatarInitialText}>
                {(member.nickname || '여행').slice(0, 1)}
              </Text>
            </View>
          ))}
          <View style={hub.avatarPlusCircle} aria-hidden>
            <TripIcon name="plus-outline" size={13} color={colors.text} />
          </View>
        </Pressable>
        {owner && openDraft ? (
          <Pressable
            testID="trip-schedule-pill"
            accessibilityRole="button"
            accessibilityLabel={t('여행 기간 수정: {p0}', {
              p0: scheduleLabel,
            })}
            disabled={locked}
            onPress={() => {
              // 우측 일정 기간 문구를 눌러 여행 기간을 수정한다.
              return openDraft('period');
            }}
            style={hub.summarySchedulePill}
          >
            <Text style={hub.summarySchedulePillText}>{scheduleLabel}</Text>
          </Pressable>
        ) : (
          <View style={hub.summarySchedulePill} testID="trip-schedule-pill">
            <Text style={hub.summarySchedulePillText}>{scheduleLabel}</Text>
          </View>
        )}
      </View>
      {presentation.phase === 'COMPLETED' && (
        <View style={hub.summaryBottomRow}>
          <Text style={hub.meta}>
            {t(
              '여행이 끝났어요. 남긴 일정과 사진, 비용을 기록에서 확인해 보세요.',
            )}
          </Text>
          <Action
            label={t('기록 보러가기')}
            onPress={() => {
              // 종료된 여행의 일정·사진·비용을 날짜별로 읽는다.
              return router.push(`/diary/${snapshot.trip.id}`);
            }}
          />
        </View>
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

// 실제 여행의 공통 이동 헤더(< Title | ⋮)를 표시한다.
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
        title={snapshot?.trip.title || t('여행 일정')}
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
                    /* 우측 상단 ⋮ 메뉴로 여행 부가 설정을 연다. */ return setShowTripMore(
                      true,
                    );
                  },
                },
              ]
            : undefined
        }
      />
    )
  );
}
