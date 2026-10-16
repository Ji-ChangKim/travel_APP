import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';
import TripIcon from '@/components/icons/TripIcon';
import { ServerPhoto } from './ui';
import GooglePlace from './GooglePlace';
import FlightCard from './FlightCard';
import TripScheduleEmpty from './TripScheduleEmpty';
import ScheduleConflictNotice from './scheduleConflicts';
import { scheduleFlight } from './flightModel';
import {
  scheduleDate,
  scheduleDuration,
  scheduleKind,
  schedulesForDay,
} from './schedulePresentation';
import { ScheduleButton } from './ScheduleControls';
import {
  scheduleStyles as shared,
  scheduleTheme as theme,
} from './scheduleTheme';

type Day = WorkspaceSnapshot['days'][number];
interface Props {
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
  onDelete: (item: WorkspaceSchedule) => void;
  onExpense: (item: WorkspaceSchedule) => void;
  onReorder: (ids: string[]) => void;
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
              <View style={s.placeCard}>
                <View style={s.cardTop}>
                  <View style={s.badge}>
                    <TripIcon
                      name={
                        scheduleFlight(item)
                          ? 'flight-outline'
                          : scheduleKind(item.type).icon
                      }
                      size={14}
                    />
                    <Text style={s.badgeText}>
                      {scheduleFlight(item)
                        ? '항공편'
                        : scheduleKind(item.type).label}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title + ' 일정 관리'}
                    accessibilityState={{
                      expanded: props.expanded[0] === item.id,
                    }}
                    onPress={() => {
                      /* 선택 장소의 관리 동작을 펼친다. */ return props.expanded[1](
                        props.expanded[0] === item.id ? '' : item.id,
                      );
                    }}
                    style={s.handle}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={theme.color.text.secondary}
                    />
                  </Pressable>
                </View>
                {scheduleFlight(item) ? (
                  <FlightCard
                    flight={scheduleFlight(item)!}
                    departureTime={item.timeSlot}
                    date={props.day.tripDate}
                  />
                ) : (
                  <Text
                    accessibilityLabel={
                      (item.timeSlot || '시간 미정') + ' · ' + item.title
                    }
                    style={s.placeTitle}
                  >
                    {item.title}
                  </Text>
                )}
                {item.address ? (
                  <Text style={shared.meta}>{item.address}</Text>
                ) : null}
                {item.memo &&
                !(
                  scheduleFlight(item) && item.memo === '사용자 등록 항공편'
                ) ? (
                  <Text style={shared.body}>{item.memo}</Text>
                ) : null}
                {props.snapshot.media
                  .filter((media) => {
                    /* 실제 여행 사진만 선택한다. */ return (
                      media.scheduleId === item.id && media.purpose === 'photo'
                    );
                  })
                  .map((media) => (
                    <ServerPhoto
                      key={media.id}
                      userId={props.userId}
                      tripId={props.snapshot.trip.id}
                      mediaId={media.id}
                    />
                  ))}
                <View style={shared.row}>
                  {item.durationMinutes ? (
                    <View style={shared.row}>
                      <TripIcon name="clock-outline" size={14} />
                      <Text style={shared.meta}>
                        체류 {scheduleDuration(item.durationMinutes)}
                      </Text>
                    </View>
                  ) : null}
                  {props.snapshot.expenses
                    .filter((expense) => {
                      /* 일정의 예상·실제 비용을 구분해 표시한다. */ return (
                        expense.scheduleId === item.id
                      );
                    })
                    .map((expense) => (
                      <View key={expense.id} style={s.spend}>
                        <Text style={shared.meta}>
                          {expense.isActual ? '실제 지출' : '예상 비용'}
                        </Text>
                        <Text style={s.amount}>
                          {expense.currency}{' '}
                          {new Intl.NumberFormat('ko-KR', {
                            maximumFractionDigits: 2,
                          }).format(Number(expense.amount))}
                        </Text>
                      </View>
                    ))}
                </View>
                {item.googlePlaceId && (
                  <GooglePlace
                    userId={props.userId}
                    placeId={item.googlePlaceId}
                    label={item.title}
                  />
                )}
                {!props.disabled && (
                  <View style={s.cardFooter}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.title + ' 사진 추가'}
                      onPress={() => {
                        /* 앨범 사진을 이 일정에 연결한다. */ return props.onPhoto(
                          item,
                        );
                      }}
                      style={s.inlineAction}
                    >
                      <TripIcon name="camera-duotone" size={16} />
                      <Text style={s.link}>사진 추가</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.title + ' 비용 추가'}
                      onPress={() => {
                        /* 선택 일정의 비용 폼을 연다. */ return props.onExpense(
                          item,
                        );
                      }}
                      style={s.inlineAction}
                    >
                      <TripIcon
                        name="receipt-scan-outline"
                        size={16}
                        color={theme.color.action.link}
                      />
                      <Text style={s.link}>비용 추가</Text>
                    </Pressable>
                  </View>
                )}
                {props.expanded[0] === item.id && (
                  <View style={{ gap: 8 }}>
                    <Text style={shared.meta}>일정 관리</Text>
                    <ScheduleButton
                      label="이 일정에서 사진 촬영"
                      disabled={props.disabled}
                      onPress={() => {
                        /* 실제 카메라를 연다. */ return props.onCapture(item);
                      }}
                    />
                    <ScheduleButton
                      label="이 일정에 사진 추가"
                      disabled={props.disabled}
                      onPress={() => {
                        /* 실제 앨범을 연다. */ return props.onPhoto(item);
                      }}
                    />
                    <ScheduleButton
                      label="일정 수정"
                      disabled={props.disabled}
                      onPress={() => {
                        /* 원래 ID로 편집한다. */ return props.onEdit(item);
                      }}
                    />
                    <ScheduleButton
                      label="일정 삭제"
                      disabled={props.disabled}
                      onPress={() => {
                        /* 기존 삭제 보호를 적용한다. */ return props.onDelete(
                          item,
                        );
                      }}
                    />
                  </View>
                )}
                {props.arranging[0] && (
                  <View style={shared.row}>
                    <ScheduleButton
                      label={item.title + ' 위로 이동'}
                      disabled={props.disabled || index === 0}
                      onPress={() => {
                        /* 앞 일정과 순서를 바꾼다. */ return props.onReorder(
                          movedIds(items, index, -1),
                        );
                      }}
                    />
                    <ScheduleButton
                      label={item.title + ' 아래로 이동'}
                      disabled={props.disabled || index === items.length - 1}
                      onPress={() => {
                        /* 뒤 일정과 순서를 바꾼다. */ return props.onReorder(
                          movedIds(items, index, 1),
                        );
                      }}
                    />
                  </View>
                )}
              </View>
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

// 이웃한 두 일정의 순서를 바꾼 요청을 만든다.
function movedIds(
  items: WorkspaceSchedule[],
  index: number,
  offset: number,
): string[] {
  // 원본을 바꾸지 않고 모든 ID를 한 번씩 포함한다.
  return items.map((item, position) => {
    /* 선택 일정과 이웃 일정만 맞바꾼다. */ return (
      items[
        position === index
          ? index + offset
          : position === index + offset
            ? index
            : position
      ]?.id || item.id
    );
  });
}

const c = theme.color;
const s = StyleSheet.create({
  tab: {
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: { borderBottomColor: c.selection.border },
  tabText: {
    fontFamily: theme.font.regular,
    fontSize: 14,
    color: c.text.secondary,
  },
  activeTab: { color: c.text.primary, fontFamily: theme.font.bold },
  days: { gap: 4, paddingVertical: 4 },
  day: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 9999,
  },
  selectedDay: {
    backgroundColor: c.selection.surface,
    borderWidth: 1,
    borderColor: c.selection.border,
  },
  dayText: { fontSize: 14, fontFamily: theme.font.bold, color: c.text.primary },
  unselectedDay: { color: c.text.secondary },
  dayDate: { fontSize: 14 },
  timeline: { gap: 16 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headingText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    lineHeight: 22,
    color: c.text.primary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.brand.coralPressed,
  },
  count: {
    fontSize: 14,
    color: c.text.secondary,
    backgroundColor: c.surface.low,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  orderButton: {
    minHeight: 44,
    padding: 4,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stop: { flexDirection: 'row', gap: 10 },
  largeStop: { flexDirection: 'column', gap: 8 },
  largeRail: { width: '100%', flexDirection: 'row', gap: 12 },
  largeMarker: {
    width: 'auto',
    height: 'auto',
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    padding: 4,
  },
  rail: { width: 64, alignItems: 'center' },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.selection.surface,
    borderWidth: 1,
    borderColor: c.selection.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coralMarker: { backgroundColor: c.selection.surface },
  number: { fontFamily: theme.font.bold, fontSize: 14, color: c.text.primary },
  time: {
    fontFamily: theme.font.semibold,
    fontSize: 16,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
    color: c.text.primary,
  },
  line: {
    width: 2,
    backgroundColor: c.border.subtle,
    flex: 1,
    minHeight: 12,
    marginTop: 6,
    marginBottom: -16,
  },
  stopContent: { flex: 1, minWidth: 0, gap: 8 },
  sectionTitle: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: c.text.primary,
  },
  placeCard: {
    padding: 16,
    gap: 10,
    backgroundColor: c.surface.card,
    borderRadius: 16,
    boxShadow: '0 2px 10px rgba(32,50,71,0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: -6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surface.low,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    color: c.text.secondary,
    fontFamily: theme.font.bold,
  },
  handle: {
    minHeight: 44,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeTitle: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    lineHeight: 26,
    color: c.text.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlineAction: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    minHeight: 44,
  },
  link: {
    fontFamily: theme.font.bold,
    color: c.action.link,
    fontSize: 14,
  },
  spend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 8,
    backgroundColor: c.surface.low,
    borderRadius: 8,
  },
  amount: {
    fontFamily: theme.font.semibold,
    fontSize: 16,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: c.text.primary,
  },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
});
