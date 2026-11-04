import type { WorkspaceSnapshot } from '@wherego/domain';

import type { Dispatch, SetStateAction } from 'react';

import TripMap from './TripMap';

import { TripDayStrip } from '../../schedule/manager/TripTimeline';
import { type PlanForm } from '../../forms';

import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { workspaceDaySelection } from '../model/workspaceDaySelection';

type RenderWorkspaceMapProps = {
  activeSection: string;
  form: PlanForm | null;
  snapshot: WorkspaceSnapshot;
  selectedDay: string;
  setSelectedDay: Dispatch<SetStateAction<string>>;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  actions: WorkspaceScreenActions;
};

// 선택 날짜의 지도 영역을 표시한다.
export function renderWorkspaceMap({
  activeSection,
  form,
  snapshot,
  selectedDay,
  setSelectedDay,
  writable,
  busy,
  scanning,
  hasPending,
  actions,
}: RenderWorkspaceMapProps) {
  const daySelection = workspaceDaySelection(snapshot.days, selectedDay);
  return (
    activeSection === 'map' &&
    !form && (
      <>
        <TripDayStrip
          days={snapshot.days}
          selected={daySelection.selected}
          onSelect={setSelectedDay}
        />
        <TripMap
          key={selectedDay}
          snapshot={snapshot}
          dayId={daySelection.currentDayId}
          disabled={!writable || busy || scanning || hasPending}
          onEdit={(item) => actions.editSchedule(item)}
        />
      </>
    )
  );
}
