import {
  destinationForDay,
  type WorkspaceSchedule,
  type WorkspaceSnapshot,
} from '@wherego/domain';

import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';

import ScheduleCoursePicker from './ScheduleCoursePicker';

import TripMapCanvas from './TripMapCanvas';
import { tripMapStops } from './tripMapModel';
import { triggerHaptic } from '@/components/haptics';
import { colors } from '@/constants/theme';
import TripTimeline, { TripDayStrip } from './TripTimeline';

import type { WorkspaceDraftKind } from './workspaceDrafts';
import type { WorkspaceScreenActions } from './workspaceScreenActions';
import { workspaceDaySelection } from './workspaceDaySelection';

type RenderWorkspaceCourseProps = {
  snapshot: WorkspaceSnapshot | undefined;
  courseDay: string;
  setCourseDay: Dispatch<SetStateAction<string>>;
  actions: WorkspaceScreenActions;
};

// 선택 날짜에 넣을 추천 코스 선택을 표시한다.
export function renderWorkspaceCourse({
  snapshot,
  courseDay,
  setCourseDay,
  actions,
}: RenderWorkspaceCourseProps): import('react').ReactNode {
  const courseDest =
    snapshot && courseDay
      ? destinationForDay(snapshot, courseDay)
      : snapshot?.trip;
  return (
    snapshot && (
      <ScheduleCoursePicker
        visible={Boolean(courseDay)}
        country={courseDest?.country || snapshot.trip.country}
        city={courseDest?.city || snapshot.trip.city}
        onClose={() => {
          // 미리보기 취소는 일정이나 날짜를 바꾸지 않는다.
          return setCourseDay('');
        }}
        onSelect={(place) => {
          /* 코스 선택 후 같은 작성 화면으로 이동한다. */ actions.chooseCoursePlace(
            courseDay,
            place,
          );
          setCourseDay('');
        }}
        onSearch={() => {
          /* 선택 날짜의 실제 장소 검색을 연다. */ actions.addSchedule(
            courseDay,
          );
          setCourseDay('');
        }}
      />
    )
  );
}

type RenderWorkspaceItineraryProps = {
  activeSection: string;
  setActiveSection?: Dispatch<SetStateAction<string>>;
  snapshot: WorkspaceSnapshot;
  selectedDay: string;
  setSelectedDay: Dispatch<SetStateAction<string>>;
  selectedScheduleId?: string;
  setSelectedScheduleId?: Dispatch<SetStateAction<string>>;
  userId: string;
  writable: boolean;
  setCourseDay: Dispatch<SetStateAction<string>>;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  photo: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  actions: WorkspaceScreenActions;
};

// 선택 날짜의 일정과 편집 행동을 표시한다.
export function renderWorkspaceItinerary({
  activeSection,
  setActiveSection,
  snapshot,
  selectedDay,
  setSelectedDay,
  selectedScheduleId = '',
  setSelectedScheduleId,
  userId,
  writable,
  setCourseDay,
  busy,
  scanning,
  hasPending,
  openDraft,
  photo,
  actions,
}: RenderWorkspaceItineraryProps) {
  const daySelection = workspaceDaySelection(snapshot.days, selectedDay, true);
  const currentStops = tripMapStops(
    snapshot.itinerary,
    daySelection.currentDayId,
  );

  return (
    activeSection === 'itinerary' && (
      <>
        {currentStops.length > 0 && (
          <View
            style={{
              marginBottom: 16,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            <TripMapCanvas
              stops={currentStops}
              selectedId={selectedScheduleId}
              onSelect={(id) => {
                triggerHaptic('selection');
                setSelectedScheduleId?.(id);
              }}
            />
          </View>
        )}
        <TripDayStrip
          allowAll
          days={snapshot.days}
          selected={daySelection.selected}
          onSelect={(dayId) => {
            triggerHaptic('light');
            setSelectedDay(dayId);
          }}
        />
        {daySelection.visibleDays.map((day) => (
          <TripTimeline
            key={day.id}
            snapshot={snapshot}
            userId={userId}
            day={day}
            selectedScheduleId={selectedScheduleId}
            onSelectSchedule={(id) => {
              triggerHaptic('selection');
              setSelectedScheduleId?.(id);
            }}
            canCreate={writable}
            onPlan={() => actions.editDayPlan(day)}
            onAdd={() => actions.addSchedule(day.id)}
            onCourse={() => {
              // 코스를 넣을 날짜를 선택 당시 값으로 고정한다.
              return setCourseDay(day.id);
            }}
            onSelectCategory={(category) => {
              return actions.addScheduleByCategory(day.id, category);
            }}
            onSelectSpot={(spot) => {
              return actions.chooseCoursePlace(day.id, spot);
            }}
            onOpenMap={
              setActiveSection
                ? () => {
                    return setActiveSection('map');
                  }
                : undefined
            }
            disabled={!writable || busy || scanning || hasPending}
            onReorder={(ids) => actions.reorderSchedules(day.id, ids)}
            onRecommend={(item) => actions.chooseRecommendation(day.id, item)}
            onRoute={actions.saveTravelLeg}
            onExpense={(item) => {
              // 선택 장소에 실제 지출을 연결한다.
              return openDraft('expense', item);
            }}
            onCapture={(item) => {
              // 실제 카메라 사진을 선택한 장소에 연결한다.
              return photo('photo', true, item.id);
            }}
            onPhoto={(item) => {
              // 기존 앨범 사진을 선택한 장소에 연결한다.
              return photo('photo', false, item.id);
            }}
            onEdit={(item) => actions.editSchedule(item)}
            onCopy={(item) => actions.copySchedule(item)}
            onDelete={(item) => actions.deleteSchedule(item)}
          />
        ))}
      </>
    )
  );
}
