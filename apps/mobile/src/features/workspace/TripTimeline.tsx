import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';
import { Action, ServerPhoto } from './ui';
import GooglePlace from './GooglePlace';

type Day = WorkspaceSnapshot['days'][number];

// 여행 작업 영역은 둥근 버튼 묶음 대신 읽기 쉬운 탭으로 제공한다.
export function HubTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  // 선택 상태를 색과 밑줄로 함께 구분한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.tab, selected && s.selectedTab]}
    >
      <Text style={[s.tabText, selected && s.activeTabText]}>{label}</Text>
    </Pressable>
  );
}
interface Props {
  snapshot: WorkspaceSnapshot;
  userId: string;
  day: Day;
  disabled: boolean;
  onCapture: (item: WorkspaceSchedule) => void;
  onPhoto: (item: WorkspaceSchedule) => void;
  onEdit: (item: WorkspaceSchedule) => void;
  onDelete: (item: WorkspaceSchedule) => void;
}

// 선택 날짜와 현지 월·일을 같은 버튼에서 확인한다.
export function TripDayStrip({
  days,
  selected,
  onSelect,
}: {
  days: Day[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  // 길어진 여행 기간은 가로 스크롤로 탐색한다.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.days}
      accessibilityLabel="여행 날짜 선택"
    >
      {days.map((day) => (
        /* 각 날짜는 선택 상태와 실제 현지 날짜를 함께 제공한다. */
        <Pressable
          key={day.id}
          accessibilityRole="button"
          accessibilityLabel={`DAY ${day.dayNumber}`}
          accessibilityState={{ selected: day.id === selected }}
          style={[s.day, day.id === selected && s.selectedDay]}
          onPress={() => {
            // 누른 날짜의 실제 일정만 보여준다.
            return onSelect(day.id);
          }}
        >
          <Text style={[s.dayNumber, day.id === selected && s.selectedText]}>
            DAY {day.dayNumber}
          </Text>
          <Text style={[s.date, day.id === selected && s.selectedText]}>
            {day.tripDate.slice(5).replace('-', '.')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// 실제 일정은 경로선·장소 카드·사진·지출의 순서로 읽는다.
export default function TripTimeline(props: Props) {
  // 일정별 관리 동작은 필요할 때만 펼쳐 타임라인을 가리지 않는다.
  return <TimelineContent {...props} expanded={useState('')} />;
}

// 날짜 안의 장소를 서버의 정렬 순서로 구성한다.
function TimelineContent({
  snapshot,
  userId,
  day,
  disabled,
  onCapture,
  onPhoto,
  onEdit,
  onDelete,
  expanded,
}: Props & { expanded: [string, (id: string) => void] }) {
  // 없는 거리·추천·날씨를 만들어 넣지 않고 저장된 내용만 표시한다.
  return (
    <View style={s.timeline}>
      <Text style={s.dayHeading}>
        DAY {day.dayNumber} · {day.tripDate}
      </Text>
      {!snapshot.itinerary.some((item) => {
        // 이 날짜가 비었을 때 다음 행동을 안내한다.
        return item.dayId === day.id;
      }) && (
        <View style={s.empty}>
          <Ionicons name="location-outline" size={25} color="#C84432" />
          <Text style={s.emptyTitle}>이날의 첫 장소를 추가해 보세요.</Text>
          <Text style={s.meta}>
            숙소, 맛집, 관광지를 원하는 순서로 계획해요.
          </Text>
        </View>
      )}
      {snapshot.itinerary
        .filter((item) => {
          // 선택 날짜 밖의 일정은 섞지 않는다.
          return item.dayId === day.id;
        })
        .sort((a, b) => {
          // 동일 시간이라도 사용자가 저장한 순서를 유지한다.
          return a.sortOrder - b.sortOrder;
        })
        .map((item) => (
          /* 장소 한 개의 위치·사진·실제 비용을 같은 카드에서 읽는다. */
          <View key={item.id} style={s.stop}>
            <View style={s.rail}>
              <View style={[s.marker, item.type === 'PLACE' && s.coralMarker]}>
                <Ionicons
                  name={
                    item.type === 'RESERVATION'
                      ? 'calendar'
                      : item.type === 'STAY'
                        ? 'bed'
                        : item.type === 'TRANSPORT'
                          ? 'bus'
                          : 'location'
                  }
                  size={15}
                  color="#FFFFFF"
                />
              </View>
              <View style={s.line} />
            </View>
            <View style={s.placeCard}>
              <Text style={s.placeTitle}>
                {item.timeSlot || '시간 미정'} · {item.title}
              </Text>
              {item.address ? <Text style={s.meta}>{item.address}</Text> : null}
              {item.googlePlaceId && (
                <GooglePlace
                  userId={userId}
                  placeId={item.googlePlaceId}
                  label={item.title}
                />
              )}
              {item.memo && <Text style={s.memo}>{item.memo}</Text>}
              {snapshot.media
                .filter((media) => {
                  // 여행 사진만 타임라인에 표시하고 영수증 원본은 별도 화면에서 읽는다.
                  return (
                    media.scheduleId === item.id && media.purpose === 'photo'
                  );
                })
                .map((media) => (
                  /* 등록한 실제 여행 사진만 장소 안에 표시한다. */
                  <ServerPhoto
                    key={media.id}
                    userId={userId}
                    tripId={snapshot.trip.id}
                    mediaId={media.id}
                  />
                ))}
              {snapshot.expenses
                .filter((expense) => {
                  // 예상 비용과 실제 지출을 혼동하지 않는다.
                  return expense.scheduleId === item.id && expense.isActual;
                })
                .map((expense) => (
                  /* 통화를 합치지 않고 지출 한 건씩 표시한다. */
                  <View key={expense.id} style={s.spend}>
                    <Text style={s.meta}>{expense.title}</Text>
                    <Text style={s.amount}>
                      {expense.currency}{' '}
                      {new Intl.NumberFormat('ko-KR', {
                        maximumFractionDigits: 2,
                      }).format(Number(expense.amount))}
                    </Text>
                  </View>
                ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 일정 관리`}
                accessibilityState={{ expanded: expanded[0] === item.id }}
                style={s.manage}
                onPress={() => {
                  // 사진 추가·수정·삭제는 선택한 장소에서만 펼친다.
                  return expanded[1](expanded[0] === item.id ? '' : item.id);
                }}
              >
                <Text style={s.manageText}>일정 관리</Text>
                <Ionicons
                  name={
                    expanded[0] === item.id
                      ? 'chevron-up'
                      : 'ellipsis-horizontal'
                  }
                  size={17}
                  color="#697581"
                />
              </Pressable>
              {expanded[0] === item.id && (
                <View style={s.actions}>
                  <Action
                    label="이 일정에서 사진 촬영"
                    disabled={disabled}
                    onPress={() => {
                      // 현장에서 촬영한 사진을 해당 일정에 연결한다.
                      return onCapture(item);
                    }}
                  />
                  <Action
                    label="이 일정에 사진 추가"
                    disabled={disabled}
                    onPress={() => {
                      // 앨범 사진을 해당 일정에 연결한다.
                      return onPhoto(item);
                    }}
                  />
                  <Action
                    label="일정 수정"
                    disabled={disabled}
                    onPress={() => {
                      // 원래 일정 ID로 수정 폼을 연다.
                      return onEdit(item);
                    }}
                  />
                  <Action
                    label="일정 삭제"
                    variant="danger"
                    disabled={disabled}
                    onPress={() => {
                      // 기존 삭제 명령과 영수증 연결 보호를 유지한다.
                      return onDelete(item);
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
    </View>
  );
}

// 장소 카드 사이의 경로선과 작고 선명한 정보 위계를 구성한다.
const s = StyleSheet.create({
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: { borderBottomColor: '#203247' },
  tabText: { fontSize: 13, color: '#697581' },
  activeTabText: { color: '#203247', fontWeight: '700' },
  days: { gap: 8, paddingVertical: 4 },
  day: {
    minWidth: 60,
    minHeight: 58,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F2F4F6',
  },
  selectedDay: { backgroundColor: '#203247' },
  dayNumber: { color: '#203247', fontSize: 12, fontWeight: '700' },
  date: { color: '#697581', fontSize: 11 },
  selectedText: { color: '#FFFFFF' },
  timeline: { gap: 14 },
  dayHeading: {
    color: '#697581',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  stop: { flexDirection: 'row', gap: 10 },
  rail: { width: 26, alignItems: 'center' },
  marker: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: '#203247',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coralMarker: { backgroundColor: '#C84432' },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: '#D5DCE2',
    marginTop: 6,
    marginBottom: -8,
  },
  placeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9EDF0',
  },
  placeTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    color: '#203247',
  },
  meta: { fontSize: 12, lineHeight: 19, color: '#697581', flexShrink: 1 },
  memo: { fontSize: 13, lineHeight: 21, color: '#405163' },
  spend: {
    backgroundColor: '#FFF6F1',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: { fontSize: 15, fontWeight: '700', color: '#A93C2D' },
  manage: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  manageText: { fontSize: 12, color: '#697581' },
  actions: { gap: 8 },
  empty: { gap: 10, paddingVertical: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 15, color: '#203247', fontWeight: '600' },
});
