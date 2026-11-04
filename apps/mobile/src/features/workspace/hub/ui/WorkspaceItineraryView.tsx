import {
  destinationForDay,
  type WorkspaceSchedule,
  type WorkspaceSnapshot,
} from '@wherego/domain';

import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';

import ScheduleCoursePicker from '../../schedule/ui/ScheduleCoursePicker';

import TripMapCanvas from './TripMapCanvas';
import { tripMapStops } from '../model/tripMapModel';
import { triggerHaptic } from '@/components/ui/haptics';
import TripTimeline, {
  TripDayStrip,
} from '../../schedule/manager/TripTimeline';
import { tripHubStyles as hub } from '../styles/tripHubStyles';

import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { workspaceDaySelection } from '../model/workspaceDaySelection';

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
  // 선택된 날짜의 여행지가 있으면 해당 도시 가이드를 우선 사용한다.
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
  // 유효한 선택 날짜와 해당 날짜의 지도 방문 핀 목록을 계산한다.
  const daySelection = workspaceDaySelection(snapshot.days, selectedDay, true);
  const currentStops = tripMapStops(
    snapshot.itinerary,
    daySelection.currentDayId,
  );

  return (
    activeSection === 'itinerary' && (
      <>
        {currentStops.length > 0 && (
          <View style={hub.mapPreviewCard}>
            <TripMapCanvas
              stops={currentStops}
              selectedId={selectedScheduleId}
              onSelect={(id) => {
                // 미니맵에서 고른 핀을 아래 타임라인 카드와 연동한다.
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
            // 선택한 일차 또는 전체 일정을 즉시 전환한다.
            triggerHaptic('light');
            setSelectedDay(dayId);
          }}
        />
        {daySelection.visibleDays.map((day) => {
          // 표시 대상인 각 일차의 타임라인과 빈 상태 가이드를 렌더링한다.
          return (
            <TripTimeline
              key={day.id}
              snapshot={snapshot}
              userId={userId}
              day={day}
              selectedScheduleId={selectedScheduleId}
              onSelectSchedule={(id) => {
                // 타임라인 카드 선택을 상단 미니맵 핀 강조와 동기화한다.
                triggerHaptic('selection');
                setSelectedScheduleId?.(id);
              }}
              canCreate={writable}
              onPlan={() => {
                // 선택한 날짜의 제목과 여행 메모 편집 모달을 연다.
                return actions.editDayPlan(day);
              }}
              onAdd={() => {
                // 해당 날짜의 장소 검색이 펼쳐진 일정 작성 초안을 연다.
                return actions.addSchedule(day.id);
              }}
              onCourse={() => {
                // 코스를 넣을 날짜를 선택 당시 값으로 고정한다.
                return setCourseDay(day.id);
              }}
              onSelectCategory={(category) => {
                // 선택한 카테고리 유형을 반영해 일정 작성 초안을 연다.
                return actions.addScheduleByCategory(day.id, category);
              }}
              onSelectSpot={(spot) => {
                // 추천 명소의 제목과 설명을 해당 날짜 초안에 담아 연다.
                return actions.chooseCoursePlace(day.id, spot);
              }}
              onOpenMap={
                setActiveSection
                  ? () => {
                      // 여행 상세의 지도 탭으로 즉시 전환한다.
                      return setActiveSection('map');
                    }
                  : undefined
              }
              disabled={!writable || busy || scanning || hasPending}
              onReorder={(ids) => {
                // 변경한 방문 순서를 서버 버전 계약으로 저장한다.
                return actions.reorderSchedules(day.id, ids);
              }}
              onRecommend={(item) => {
                // AI 추천 장소를 해당 날짜의 새 일정 초안으로 연다.
                return actions.chooseRecommendation(day.id, item);
              }}
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
              onEdit={(item) => {
                // 선택한 기존 일정을 수정 모달로 연다.
                return actions.editSchedule(item);
              }}
              onCopy={(item) => {
                // 선택한 일정의 장소·메모를 복제한 새 초안을 연다.
                return actions.copySchedule(item);
              }}
              onDelete={(item) => {
                // 연결 기록 확인 절차를 거쳐 일정을 삭제한다.
                return actions.deleteSchedule(item);
              }}
            />
          );
        })}
      </>
    )
  );
}
