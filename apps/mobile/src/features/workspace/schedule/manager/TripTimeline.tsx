import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import { Ionicons } from '@expo/vector-icons';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import type {
  WorkspaceSchedule,
  WorkspaceSnapshot,
  TravelLeg,
} from '@wherego/domain';
import { destinationForDay } from '@wherego/domain';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { renderTimelinePlace, s } from '../ui/TripTimelineView';

import TripScheduleEmpty, {
  type EmptyScheduleCategory,
} from '../ui/TripScheduleEmpty';
import type { CityGuidePlace } from '../../community/model/cityGuides';
import { scheduleFlight } from '../../planning/model/flightModel';
import ScheduleConflictNotice from '../ui/scheduleConflicts';
import {
  formatDayChipLabel,
  scheduleDate,
  schedulesForDay,
  travelLegForStop,
} from '../model/schedulePresentation';
import {
  scheduleStyles as shared,
  scheduleTheme as theme,
} from '../styles/scheduleTheme';
import DayRecommendations, {
  type RecommendedPlace,
} from '../ui/DayRecommendations';
import TravelRoute from '../../planning/ui/TravelRoute';
import { useTripStore } from '@/stores/useTripStore';

type Day = WorkspaceSnapshot['days'][number];
export interface Props {
  snapshot: WorkspaceSnapshot;
  userId: string;
  day: Day;
  disabled: boolean;
  canCreate: boolean;
  onAdd: () => void;
  onCourse: () => void;
  onPlan?: () => void;
  onSelectCategory?: (category: EmptyScheduleCategory) => void;
  onSelectSpot?: (spot: CityGuidePlace) => void;
  onOpenMap?: () => void;
  onCapture: (item: WorkspaceSchedule) => void;
  onPhoto: (item: WorkspaceSchedule) => void;
  onEdit: (item: WorkspaceSchedule) => void;
  onCopy: (item: WorkspaceSchedule) => void;
  onDelete: (item: WorkspaceSchedule) => void;
  onExpense: (item: WorkspaceSchedule) => void;
  onReorder: (ids: string[]) => void;
  onRecommend: (item: RecommendedPlace) => void;
  onRoute: (leg: TravelLeg) => void;
  selectedScheduleId?: string;
  onSelectSchedule?: (id: string) => void;
}

// 다른 여행 작업은 짧은 보조 탭으로 제공한다.
export function HubTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  useLocale();
  // 선택 상태를 색과 밑줄로 표시한다.
  return (
    <DesignButton
      label={label}
      selected={selected}
      size="chip"
      onPress={onPress}
    />
  );
}

// 전체와 DAY를 원본의 얇은 가로 선택 바에 둔다.
export function TripDayStrip({
  days,
  selected,
  onSelect,
  allowAll = false,
}: {
  days: Day[];
  selected: string;
  onSelect: (id: string) => void;
  allowAll?: boolean;
}) {
  useLocale();
  // 긴 여행도 한 줄에서 날짜를 탐색한다.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.days}
      accessibilityLabel={t('여행 날짜 선택')}
    >
      {allowAll && (
        <DesignButton
          label={t('전체')}
          size="chip"
          accessibilityLabel={t('전체 일정')}
          selected={selected === 'all'}
          selectionStyle="fill"
          onPress={() => {
            /* 전체 날짜를 조회한다. */ return onSelect('all');
          }}
        />
      )}
      {days.map((day) => {
        // 선택한 날짜를 채움형 칩으로 강조해 표시한다.
        return (
          <DesignButton
            label={formatDayChipLabel(day, 'slash')}
            size="chip"
            key={day.id}
            accessibilityLabel={'DAY ' + day.dayNumber}
            selected={selected === day.id}
            selectionStyle="fill"
            onPress={() => {
              /* 실제 DAY만 선택한다. */ return onSelect(day.id);
            }}
          />
        );
      })}
    </ScrollView>
  );
}

// 방문 번호·시각·장소를 원본의 정보 위계로 표시한다.
export default function TripTimeline(props: Props) {
  useLocale();
  // 관리와 정렬 상태는 선택 날짜마다 분리한다.
  return (
    <TimelineContent
      {...props}
      expanded={useState('')}
      arranging={useState(false)}
      largeText={useAppAccessibility().largeText}
    />
  );
}

// 선택 날짜의 DAY 번호·도시 배지·일정 개수와 순서 편집 진입을 표시한다.
function TimelineDayHeading({
  props,
  city,
  itemCount,
}: {
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  };
  city: string;
  itemCount: number;
}) {
  useLocale();
  // 두 개 이상의 방문 일정이 있을 때만 순서 편집 버튼을 노출한다.
  return (
    <View style={s.heading}>
      <View style={s.headingMain}>
        <View style={shared.row}>
          <Text style={s.dayAccentLabel}>DAY {props.day.dayNumber}</Text>
          <Text style={s.headingText}>
            {scheduleDate(props.day.tripDate)} {t('일정')}
          </Text>
          {city ? (
            <View style={s.cityPillBadge}>
              <Text style={s.cityPillText}>{city}</Text>
            </View>
          ) : null}
          <Text style={s.count}>
            {itemCount}
            {t('개')}
          </Text>
        </View>
        <Text style={shared.meta}>
          DAY {props.day.dayNumber} · {props.day.tripDate}
          {props.snapshot.trip.destinations?.length ? ` · ${city}` : ''}
        </Text>
        {props.day.planTitle ? (
          <Text style={s.headingText}>{props.day.planTitle}</Text>
        ) : null}
        {props.day.planConcept ? (
          <Text style={shared.meta}>{props.day.planConcept}</Text>
        ) : null}
      </View>
      {!props.disabled && itemCount > 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            props.arranging[0] ? t('순서 편집 마치기') : t('순서 편집')
          }
          onPress={() => {
            /* 정렬 조작을 펼친다. */ return props.arranging[1](
              !props.arranging[0],
            );
          }}
          style={s.orderButton}
        >
          <TripIcon name="sliders-outline" size={16} />
          <Text style={shared.meta}>
            {props.arranging[0] ? t('완료') : t('순서 편집')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// 날짜별 제목과 방문 목록을 구성한다.
function TimelineContent(
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  },
) {
  useLocale();
  // 순서 변경은 상위 화면의 버전·재시도 계약으로 저장한다.
  const remote = useTripStore((state) => {
    // 게스트가 아닌 인증 회원의 원격 여행인지 확인한다.
    return (
      state.currentUser?.id === props.userId &&
      state.currentUser.authProvider !== 'guest'
    );
  });
  const dayDest = destinationForDay(props.snapshot, props.day.id);
  const dayItems = schedulesForDay(props.snapshot.itinerary, props.day.id);
  const existingTitles = props.snapshot.itinerary.map((item) => {
    // 추천 명소 카드에서 이미 담긴 장소 제목을 식별한다.
    return item.title;
  });

  return (
    <View style={s.timeline}>
      <TimelineDayHeading
        props={props}
        city={dayDest.city}
        itemCount={dayItems.length}
      />
      <ScheduleConflictNotice items={dayItems} />
      {props.onPlan && props.canCreate && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('이날 여행계획 정리')}
          disabled={props.disabled}
          onPress={props.onPlan}
          style={s.memoBanner}
        >
          <View style={s.memoBannerLeft}>
            <View aria-hidden>
              <Ionicons
                name="sunny-outline"
                size={18}
                color={theme.color.brand.coralPressed}
              />
            </View>
            <Text
              style={s.memoBannerText}
              numberOfLines={props.largeText ? 2 : 1}
            >
              {props.day.planTitle
                ? t('이날의 여행 메모 · 계획 수정하기')
                : t('이날의 준비물이나 특별한 여행 메모를 적어보세요')}
            </Text>
          </View>
          <View aria-hidden>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.color.text.secondary}
            />
          </View>
        </Pressable>
      )}
      {remote && props.canCreate && Boolean(dayDest.city.trim()) && (
        <DayRecommendations
          key={`${props.userId}:${props.day.id}:${props.snapshot.trip.version}`}
          snapshot={props.snapshot}
          dayId={props.day.id}
          userId={props.userId}
          disabled={props.disabled}
          onChoose={props.onRecommend}
        />
      )}
      {props.arranging[0] && (
        <Text style={shared.meta}>
          {t('화살표를 눌러 방문 순서를 바꿔 보세요.')}
        </Text>
      )}
      {!dayItems.length && (
        <TripScheduleEmpty
          canCreate={props.canCreate}
          disabled={props.disabled}
          onSearch={props.onAdd}
          onCourse={props.onCourse}
          country={dayDest.country}
          city={dayDest.city}
          existingTitles={existingTitles}
          onSelectCategory={props.onSelectCategory}
          onSelectSpot={props.onSelectSpot}
          onOpenMap={props.onOpenMap}
        />
      )}
      {dayItems.map((item, index, items) => {
        // 각 방문 번호와 다음 장소까지의 이동 구간을 순서대로 표시한다.
        const nextItem = items[index + 1];
        const routeState = nextItem
          ? travelLegForStop(
              props.snapshot.travelLegs,
              props.day.id,
              item.id,
              nextItem.id,
            )
          : null;
        return (
          <View key={item.id} style={[s.stop, props.largeText && s.largeStop]}>
            <View style={[s.rail, props.largeText && s.largeRail]}>
              <View
                style={[
                  s.marker,
                  item.type === 'PLACE' && s.coralMarker,
                  props.selectedScheduleId === item.id && s.selectedMarker,
                  props.largeText && s.largeMarker,
                ]}
              >
                <Text
                  style={
                    props.selectedScheduleId === item.id
                      ? s.selectedNumber
                      : s.number
                  }
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={s.time}>{item.timeSlot || t('미정')}</Text>
              <View style={[s.line, props.largeText && s.hiddenLine]} />
            </View>
            <View style={s.stopContent}>
              {scheduleFlight(item) ? (
                <Text style={s.sectionTitle}>{t('항공편')}</Text>
              ) : index > 0 && scheduleFlight(items[index - 1]) ? (
                <Text style={s.sectionTitle}>{t('다음 일정')}</Text>
              ) : null}
              {renderTimelinePlace({ item, props, index, items })}
              {remote &&
                nextItem &&
                routeState &&
                (props.canCreate || routeState.saved) &&
                (item.googlePlaceId || item.location) &&
                (nextItem.googlePlaceId || nextItem.location) && (
                  <TravelRoute
                    key={`${props.userId}:${props.snapshot.trip.version}:${item.id}:${nextItem.id}`}
                    source={{
                      preview: {
                        tripId: props.snapshot.trip.id,
                        userId: props.userId,
                      },
                    }}
                    leg={routeState.leg}
                    saved={routeState.saved}
                    disabled={props.disabled && props.canCreate}
                    onSelect={
                      props.canCreate
                        ? (mode) => {
                            // 선택한 이동수단을 두 방문 장소 구간에 저장한다.
                            return props.onRoute({
                              dayId: props.day.id,
                              fromScheduleId: item.id,
                              toScheduleId: nextItem.id,
                              mode,
                            });
                          }
                        : undefined
                    }
                  />
                )}
              {scheduleFlight(item) && index === items.length - 1 && (
                <View style={s.flightFollowup}>
                  <Text style={s.sectionTitle}>{t('다음 일정')}</Text>
                  <Text style={shared.meta}>
                    {t('도착 후 이어질 일정을 추가해 보세요.')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
