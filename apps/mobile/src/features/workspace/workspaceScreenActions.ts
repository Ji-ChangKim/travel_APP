import type { sendWorkspaceCommand } from '@wherego/api-client';
import type {
  WorkspaceSchedule,
  WorkspaceSnapshot,
  TravelLeg,
} from '@wherego/domain';
import type { WorkspaceCommand } from '@wherego/validation';
import type { PlanForm, scheduleForm } from './forms';
import type { savedReceiptForm } from './receiptFlow';
import { copiedScheduleForm } from './scheduleCopy';
import type { RecommendedPlace } from './DayRecommendations';

type Options = {
  snapshot?: WorkspaceSnapshot;
  command: (
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
    fromForm?: boolean,
  ) => void;
  edit: (next: PlanForm) => void;
  removeRegisteredImage: (path?: string) => Promise<void>;
  createSchedule: typeof scheduleForm;
  createReceiptEdit: typeof savedReceiptForm;
};

// 화면에는 행동만 전달하고 명령 본문·초안 ID·금액 변환은 기능 계층에서 만든다.
export function createWorkspaceScreenActions(options: Options) {
  // 현재 렌더의 원본과 기존 확인·멱등·재시도 경로를 같은 행동에 연결한다.
  const {
    snapshot,
    command,
    edit,
    removeRegisteredImage,
    createSchedule,
    createReceiptEdit,
  } = options;
  return {
    saveTravelLeg: (input: TravelLeg) => {
      // 이동수단만 기존 원자 저장 경로에 전달한다.
      return command({ operation: 'schedule.route', input });
    },
    chooseRecommendation: (dayId: string, item: RecommendedPlace) => {
      // 추천 선택은 새 일정의 작성 초안이며 저장 버튼을 눌러야 확정된다.
      if (!snapshot) return;
      const form = createSchedule(snapshot, undefined, dayId);
      edit({
        ...form,
        values: {
          ...form.values,
          title: item.title,
          googlePlaceId: item.placeId,
        },
      });
    },
    completeTrip: () => {
      // 정리 상태만 바꾸고 기존 여행 제목과 여행지는 보존한다.
      return snapshot
        ? command({
            operation: 'trip.update',
            input: {
              title: snapshot.trip.title,
              country: snapshot.trip.country,
              city: snapshot.trip.city,
              status: 'COMPLETED',
            },
          })
        : undefined;
    },
    withdraw: () => {
      // 공개 중단도 기존 서버 명령과 확인 절차를 거친다.
      return command({ operation: 'community.withdraw', input: {} });
    },
    changeMemberRole: (member: WorkspaceSnapshot['members'][number]) => {
      // 소유자 변경은 서버 권한 계약에 맡기며 화면의 편집자·보기 전용 전환을 유지한다.
      return command({
        operation: 'member.role',
        input: {
          userId: member.userId,
          role: member.role === 'viewer' ? 'editor' : 'viewer',
        },
      });
    },
    removeMember: (member: WorkspaceSnapshot['members'][number]) => {
      // 참여 해제 시 기존 초대와 기록 처리 계약을 그대로 사용한다.
      return command({
        operation: 'member.remove',
        input: { userId: member.userId },
      });
    },
    revokeInvite: (item: WorkspaceSnapshot['invites'][number]) => {
      // 선택한 서버 초대 ID만 취소한다.
      return command({ operation: 'invite.revoke', input: { id: item.id } });
    },
    editReceipt: (item: WorkspaceSnapshot['receipts'][number]) => {
      // 같은 영수증과 지출을 수정하는 기존 폼을 연다.
      return snapshot ? edit(createReceiptEdit(snapshot, item)) : undefined;
    },
    deleteReceipt: (item: WorkspaceSnapshot['receipts'][number]) => {
      // 영수증과 같은 ID의 지출을 서버에서 함께 삭제한다.
      return command({ operation: 'receipt.delete', input: { id: item.id } });
    },
    deleteMedia: (media: WorkspaceSnapshot['media'][number]) => {
      // 등록 해제가 확정된 뒤에만 해당 원본 파일 정리를 이어간다.
      return command(
        { operation: 'media.delete', input: { id: media.id } },
        (result) => {
          // 정리 실패 재시도도 기존 명령 결과와 파일 경로를 유지한다.
          return removeRegisteredImage(result.path);
        },
      );
    },
    editExpense: (item: WorkspaceSnapshot['expenses'][number]) => {
      // USD 정밀도는 유지하고 정수 통화의 표시용 .00만 제거한다.
      return edit({
        kind: 'expense',
        id: item.id,
        values: {
          title: item.title,
          amount:
            item.currency === 'USD' ? item.amount : item.amount.split('.')[0]!,
          currency: item.currency,
          isActual: String(item.isActual),
          category: item.category,
          scheduleId: item.scheduleId || '',
        },
      });
    },
    deleteExpense: (item: WorkspaceSnapshot['expenses'][number]) => {
      // 영수증 지출 보호는 기존 expense.delete 서버 계약으로 검사한다.
      return command({ operation: 'expense.delete', input: { id: item.id } });
    },
    editDayPlan: (day: WorkspaceSnapshot['days'][number]) => {
      // 날짜와 DAY ID를 바꾸지 않고 제목·소개만 편집한다.
      return edit({
        kind: 'dayPlan',
        id: day.id,
        values: {
          planTitle: day.planTitle || '',
          planConcept: day.planConcept || '',
        },
      });
    },
    addSchedule: (dayId: string) => {
      // 한 번 생성한 일정 ID와 선택 DAY를 같은 작성 폼에 유지한다.
      if (!snapshot) return;
      const draft = createSchedule(snapshot, undefined, dayId);
      return edit({
        ...draft,
        values: { ...draft.values, placeSearchExpanded: 'true' },
      });
    },
    startSchedule: (dayId: string) => {
      // 하단 추가 버튼은 검색을 강제로 펼치지 않는 기존 작성 진입을 유지한다.
      return snapshot
        ? edit(createSchedule(snapshot, undefined, dayId))
        : undefined;
    },
    chooseCoursePlace: (
      dayId: string,
      place: { title: string; description: string },
    ) => {
      // 코스에서 고른 설명과 새 일정 ID를 한 번 만든 초안에 채운다.
      if (!snapshot) return;
      const draft = createSchedule(snapshot, undefined, dayId);
      return edit({
        ...draft,
        values: {
          ...draft.values,
          title: place.title,
          memo: place.description,
        },
      });
    },
    reorderSchedules: (dayId: string, ids: string[]) => {
      // 해당 날짜의 방문 순서를 하나의 버전 명령으로 반영한다.
      return command({ operation: 'schedule.reorder', input: { dayId, ids } });
    },
    editSchedule: (item: WorkspaceSchedule) => {
      // 기존 위치·항공·설명과 같은 일정 ID를 유지한다.
      return snapshot ? edit(createSchedule(snapshot, item)) : undefined;
    },
    copySchedule: (item: WorkspaceSchedule) => {
      // 새 일정으로 확인·저장하기 전까지 서버 자료와 연결 기록을 복사하지 않는다.
      return snapshot
        ? edit(
            copiedScheduleForm(
              createSchedule(snapshot, item),
              createSchedule(snapshot, undefined, item.dayId),
            ),
          )
        : undefined;
    },
    deleteSchedule: (item: WorkspaceSchedule) => {
      // 연결 기록 보호는 기존 일정 삭제 확인 경로에서 검사한다.
      return command({ operation: 'schedule.delete', input: { id: item.id } });
    },
  };
}

export type WorkspaceScreenActions = ReturnType<
  typeof createWorkspaceScreenActions
>;

// 상위 컨트롤러의 현재 렌더에 속한 이벤트 행동을 화면에 연결한다.
export function useWorkspaceScreenActions(
  options: Options,
): WorkspaceScreenActions {
  // 생성 중에는 요청·초안 생성·잠금 참조 읽기를 실행하지 않는 순수 바인딩이다.
  return createWorkspaceScreenActions(options);
}
