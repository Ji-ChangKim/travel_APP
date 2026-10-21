import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import type {
  WorkspaceSchedule,
  WorkspaceSnapshot,
  TravelLeg,
} from '@wherego/domain';
import { destinationForDay } from '@wherego/domain';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { renderTimelinePlace, s } from './TripTimelineView';

import { ScheduleButton } from './ScheduleControls';
import TripScheduleEmpty from './TripScheduleEmpty';
import { scheduleFlight } from './flightModel';
import ScheduleConflictNotice from './scheduleConflicts';
import { scheduleDate, schedulesForDay } from './schedulePresentation';
import { scheduleStyles as shared } from './scheduleTheme';
import DayRecommendations, {
  type RecommendedPlace,
} from './DayRecommendations';
import TravelRoute from './TravelRoute';
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
  onCapture: (item: WorkspaceSchedule) => void;
  onPhoto: (item: WorkspaceSchedule) => void;
  onEdit: (item: WorkspaceSchedule) => void;
  onCopy: (item: WorkspaceSchedule) => void;
  onDelete: (item: WorkspaceSchedule) => void;
  onExpense: (item: WorkspaceSchedule) => void;
  onReorder: (ids: string[]) => void;
  onRecommend: (item: RecommendedPlace) => void;
  onRoute: (leg: TravelLeg) => void;
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
  // 긴 여행도 한 줄에서 날짜를 탐색한다.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.days}
      accessibilityLabel="여행 날짜 선택"
    >
      {allowAll && (
        <DesignButton
          label="전체"
          size="chip"
          accessibilityLabel="전체 일정"
          selected={selected === 'all'}
          selectionStyle="fill"
          onPress={() => {
            /* 전체 날짜를 조회한다. */ return onSelect('all');
          }}
        />
      )}
      {days.map((day) => (
        <DesignButton
          label={`DAY ${day.dayNumber} ${Number(day.tripDate.slice(5, 7))}/${Number(day.tripDate.slice(8))}`}
          size="chip"
          key={day.id}
          accessibilityLabel={'DAY ' + day.dayNumber}
          selected={selected === day.id}
          selectionStyle="fill"
          onPress={() => {
            /* 실제 DAY만 선택한다. */ return onSelect(day.id);
          }}
        />
      ))}
    </ScrollView>
  );
}

// 방문 번호·시각·장소를 원본의 정보 위계로 표시한다.
export default function TripTimeline(props: Props) {
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

// 날짜별 제목과 방문 목록을 구성한다.
function TimelineContent(
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  },
) {
  // 순서 변경은 상위 화면의 버전·재시도 계약으로 저장한다.
  const remote = useTripStore(
    (state) =>
      state.currentUser?.id === props.userId &&
      state.currentUser.authProvider !== 'guest',
  );
  return (
    <View style={s.timeline}>
      <View style={s.heading}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={shared.row}>
            <View style={s.dot} />
            <Text style={s.headingText}>
              {scheduleDate(props.day.tripDate)} 일정
            </Text>
            <Text style={s.count}>
              {schedulesForDay(props.snapshot.itinerary, props.day.id).length}개
            </Text>
          </View>
          <Text style={shared.meta}>
            DAY {props.day.dayNumber} · {props.day.tripDate}
            {props.snapshot.trip.destinations?.length
              ? ` · ${destinationForDay(props.snapshot, props.day.id).city}`
              : ''}
          </Text>
          {props.day.planTitle ? (
            <Text style={s.headingText}>{props.day.planTitle}</Text>
          ) : null}
          {props.day.planConcept ? (
            <Text style={shared.meta}>{props.day.planConcept}</Text>
          ) : null}
        </View>
        {!props.disabled &&
          schedulesForDay(props.snapshot.itinerary, props.day.id).length >
            1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                props.arranging[0] ? '순서 편집 마치기' : '순서 편집'
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
                {props.arranging[0] ? '완료' : '순서 편집'}
              </Text>
            </Pressable>
          )}
      </View>
      <ScheduleConflictNotice
        items={schedulesForDay(props.snapshot.itinerary, props.day.id)}
      />
      {props.onPlan && props.canCreate && (
        <ScheduleButton
          label="이날 여행계획 정리"
          disabled={props.disabled}
          onPress={props.onPlan}
        />
      )}
      {remote &&
        props.canCreate &&
        Boolean(
          destinationForDay(props.snapshot, props.day.id).city.trim(),
        ) && (
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
        <Text style={shared.meta}>화살표를 눌러 방문 순서를 바꿔 보세요.</Text>
      )}
      {!schedulesForDay(props.snapshot.itinerary, props.day.id).length && (
        <TripScheduleEmpty
          canCreate={props.canCreate}
          disabled={props.disabled}
          onSearch={props.onAdd}
          onCourse={props.onCourse}
        />
      )}
      {schedulesForDay(props.snapshot.itinerary, props.day.id).map(
        (item, index, items) => (
          <View key={item.id} style={[s.stop, props.largeText && s.largeStop]}>
            <View style={[s.rail, props.largeText && s.largeRail]}>
              <View
                style={[
                  s.marker,
                  item.type === 'PLACE' && s.coralMarker,
                  props.largeText && s.largeMarker,
                ]}
              >
                <Text style={s.number}>{index + 1}</Text>
              </View>
              <Text style={s.time}>{item.timeSlot || '미정'}</Text>
              <View style={[s.line, props.largeText && { display: 'none' }]} />
            </View>
            <View style={s.stopContent}>
              {scheduleFlight(item) ? (
                <Text style={s.sectionTitle}>항공편</Text>
              ) : index > 0 && scheduleFlight(items[index - 1]) ? (
                <Text style={s.sectionTitle}>다음 일정</Text>
              ) : null}
              {renderTimelinePlace({ item, props, index, items })}
              {remote &&
                index < items.length - 1 &&
                (props.canCreate ||
                  props.snapshot.travelLegs?.some(
                    (leg) =>
                      leg.fromScheduleId === item.id &&
                      leg.toScheduleId === items[index + 1]!.id,
                  )) &&
                (item.googlePlaceId || item.location) &&
                (items[index + 1]?.googlePlaceId ||
                  items[index + 1]?.location) && (
                  <TravelRoute
                    key={`${props.userId}:${props.snapshot.trip.version}:${item.id}:${items[index + 1]!.id}`}
                    source={{
                      preview: {
                        tripId: props.snapshot.trip.id,
                        userId: props.userId,
                      },
                    }}
                    leg={
                      props.snapshot.travelLegs?.find(
                        (leg) =>
                          leg.fromScheduleId === item.id &&
                          leg.toScheduleId === items[index + 1]!.id,
                      ) || {
                        dayId: props.day.id,
                        fromScheduleId: item.id,
                        toScheduleId: items[index + 1]!.id,
                        mode: 'WALK',
                      }
                    }
                    saved={Boolean(
                      props.snapshot.travelLegs?.some(
                        (leg) =>
                          leg.fromScheduleId === item.id &&
                          leg.toScheduleId === items[index + 1]!.id,
                      ),
                    )}
                    disabled={props.disabled && props.canCreate}
                    onSelect={
                      props.canCreate
                        ? (mode) =>
                            props.onRoute({
                              dayId: props.day.id,
                              fromScheduleId: item.id,
                              toScheduleId: items[index + 1]!.id,
                              mode,
                            })
                        : undefined
                    }
                  />
                )}
              {scheduleFlight(item) && index === items.length - 1 && (
                <View style={{ gap: 6, paddingVertical: 12 }}>
                  <Text style={s.sectionTitle}>다음 일정</Text>
                  <Text style={shared.meta}>
                    도착 후 이어질 일정을 추가해 보세요.
                  </Text>
                </View>
              )}
            </View>
          </View>
        ),
      )}
    </View>
  );
}

export { tripTimelineStyles } from './TripTimelineView';
