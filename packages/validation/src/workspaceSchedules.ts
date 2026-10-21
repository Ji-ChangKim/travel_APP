import type { WorkspaceSchedule } from '@wherego/domain';
import type { WorkspaceCommand } from './workspace';
import {
  changed,
  rejectRequest,
  saveItem,
  validDay,
  without,
  type Snapshot,
  type Change,
  type WorkspaceId,
} from './workspaceModelCore';

type ScheduleInput = Extract<
  WorkspaceCommand,
  { operation: 'schedule.save' }
>['input'];

// 삽입 위치와 확정 영수증의 날짜 관계를 검사한다.
function validSchedulePlacement(s: Snapshot, input: ScheduleInput): boolean {
  // 다른 날짜의 장소를 기준으로 삼거나 확정 결제일을 옮기지 않는다.
  return (
    validDay(s, input.dayId) &&
    (input.afterScheduleId === undefined ||
      input.afterScheduleId === null ||
      s.itinerary.some((item) => {
        // 자기 자신을 삽입 기준으로 선택할 수 없다.
        return (
          item.id === input.afterScheduleId &&
          item.id !== input.id &&
          item.dayId === input.dayId
        );
      })) &&
    !s.receipts.some((receipt) => {
      // 확정 영수증과 연결된 일정은 결제일이 같은 DAY에만 둔다.
      return (
        receipt.scheduleId === input.id &&
        receipt.date !==
          s.days.find((day) => {
            // 선택 날짜의 현지 달력 날짜를 읽는다.
            return day.id === input.dayId;
          })?.tripDate
      );
    })
  );
}

function scheduleStoredInput(
  input: ScheduleInput,
): Omit<ScheduleInput, 'afterScheduleId' | 'estimatedCost'> {
  // 삽입 기준과 예상 비용은 일정 속성이 아니라 별도 순서·비용으로 저장한다.
  const stored = { ...input };
  delete stored.afterScheduleId;
  delete stored.estimatedCost;
  return stored;
}

// 저장 일정의 삽입 위치를 한 번에 반영한다.
function placedSchedule(
  s: Snapshot,
  input: ScheduleInput,
  item: WorkspaceSchedule,
): WorkspaceSchedule[] {
  // 이전 앱이 삽입 위치를 보내지 않으면 기존 정렬 계약을 유지한다.
  return input.afterScheduleId === undefined
    ? saveItem(s.itinerary, item)
    : [
        ...s.itinerary.filter((other) => {
          // 이동 전 일정과 목적 날짜의 일정만 재정렬 대상으로 분리한다.
          return other.id !== item.id && other.dayId !== item.dayId;
        }),
        ...insertedSchedules(s.itinerary, item, input.afterScheduleId).map(
          (other, index) => {
            // 같은 날짜 안에서만 연속된 순서 번호를 부여한다.
            return { ...other, sortOrder: index + 1 };
          },
        ),
      ];
}

// 선택 날짜의 목록에 일정 하나를 끼워 넣는다.
function insertedSchedules(
  items: WorkspaceSchedule[],
  item: WorkspaceSchedule,
  after: string | null,
): WorkspaceSchedule[] {
  // 입력 배열을 수정하지 않고 목적 날짜의 정렬 결과로 삽입한다.
  return insertAt(
    items
      .filter((other) => {
        // 편집 중인 자기 자신은 미리보기 목록에서 제거한다.
        return other.dayId === item.dayId && other.id !== item.id;
      })
      .sort((a, b) => {
        // 저장된 방문 순서를 기준으로 삼는다.
        return a.sortOrder - b.sortOrder;
      }),
    item,
    after,
  );
}

function insertAt(
  items: WorkspaceSchedule[],
  item: WorkspaceSchedule,
  after: string | null,
): WorkspaceSchedule[] {
  const index =
    after === null ? 0 : items.findIndex((other) => other.id === after) + 1;
  return [...items.slice(0, index), item, ...items.slice(index)];
}

// 일정과 예상 비용을 같은 변경 결과로 저장한다.
function scheduleEstimates(
  s: Snapshot,
  input: ScheduleInput,
  identify: WorkspaceId,
): Snapshot['expenses'] {
  // 실제 지출과 영수증 비용은 수정하거나 삭제하지 않는다.
  return input.estimatedCost === undefined
    ? s.expenses
    : input.estimatedCost === null
      ? s.expenses.filter((expense) => {
          // 이 입력 화면에서 만든 예상 비용만 해제한다.
          return (
            expense.scheduleId !== input.id ||
            expense.source !== 'schedule-plan'
          );
        })
      : saveItem(s.expenses, {
          id:
            s.expenses.find((expense) => {
              // 다시 저장할 때 같은 예상 비용 ID를 재사용한다.
              return (
                expense.scheduleId === input.id &&
                expense.source === 'schedule-plan'
              );
            })?.id || identify(),
          dayId: input.dayId,
          scheduleId: input.id,
          title: `${input.title} 예상 비용`,
          ...input.estimatedCost,
          isActual: false,
          category:
            input.type === 'STAY'
              ? 'stay'
              : input.type === 'TRANSPORT'
                ? 'transport'
                : 'activity',
          source: 'schedule-plan',
        });
}
export function saveSchedule(
  snapshot: Snapshot,
  input: ScheduleInput,
  identify: WorkspaceId,
): Change {
  if (!validSchedulePlacement(snapshot, input))
    return rejectRequest('VALIDATION_FAILED');
  const previous = snapshot.itinerary.find((item) => item.id === input.id);
  // 생략은 이전 앱의 수정이므로 보존하고 null은 사용자가 지운 값으로 처리한다.
  const schedule: WorkspaceSchedule = {
    ...scheduleStoredInput(input),
    planContent:
      input.planContent === undefined
        ? previous?.planContent
        : input.planContent,
    durationMinutes:
      input.durationMinutes === undefined
        ? previous?.durationMinutes
        : input.durationMinutes,
    flight:
      input.type !== 'TRANSPORT'
        ? null
        : input.flight === undefined
          ? previous?.flight
          : input.flight,
    location:
      input.location === undefined ? previous?.location : input.location,
    timeSlot: input.timeSlot || null,
    memo: input.memo || null,
    googlePlaceId: input.googlePlaceId || undefined,
  };
  return changed(
    snapshot,
    {
      itinerary: placedSchedule(snapshot, input, schedule),
      expenses: scheduleEstimates(snapshot, input, identify).map((expense) =>
        expense.scheduleId === input.id
          ? { ...expense, dayId: input.dayId }
          : expense,
      ),
    },
    { id: input.id },
  );
}

export function reorderSchedules(
  snapshot: Snapshot,
  input: Extract<WorkspaceCommand, { operation: 'schedule.reorder' }>['input'],
): Change {
  const ids = new Set(input.ids);
  const schedules = snapshot.itinerary.filter(
    (item) => item.dayId === input.dayId,
  );
  // 부분 목록과 중복 ID는 방문 누락을 일으키므로 공통 모델에서도 거부한다.
  if (
    !validDay(snapshot, input.dayId) ||
    ids.size !== input.ids.length ||
    ids.size !== schedules.length ||
    !schedules.every((item) => ids.has(item.id))
  ) {
    return rejectRequest('VALIDATION_FAILED');
  }
  const positions = new Map(input.ids.map((id, index) => [id, index + 1]));
  return changed(snapshot, {
    itinerary: snapshot.itinerary.map((item) =>
      item.dayId === input.dayId
        ? { ...item, sortOrder: positions.get(item.id)! }
        : item,
    ),
  });
}

export function deleteSchedule(snapshot: Snapshot, id: string): Change {
  // 영수증의 부모 방문은 삭제할 수 없고 사진·수동 지출은 독립 기록으로 남긴다.
  if (snapshot.receipts.some((item) => item.scheduleId === id))
    return rejectRequest('VALIDATION_FAILED');
  return changed(snapshot, {
    itinerary: without(snapshot.itinerary, id),
    media: snapshot.media.map((item) =>
      item.scheduleId === id ? { ...item, scheduleId: null } : item,
    ),
    expenses: snapshot.expenses
      .filter(
        (item) => item.scheduleId !== id || item.source !== 'schedule-plan',
      )
      .map((item) =>
        item.scheduleId === id ? { ...item, scheduleId: null } : item,
      ),
  });
}
