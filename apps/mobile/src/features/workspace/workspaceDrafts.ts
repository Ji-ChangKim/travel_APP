import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';
import type { PlanForm } from './forms';
import { destinationForm } from './destinationForms';

export type WorkspaceDraftKind =
  | 'expense'
  | 'plan-share'
  | 'record-share'
  | 'metadata'
  | 'period'
  | 'destinations';

// 화면 배치와 무관하게 실제 원본에서 새 작성 초안 하나를 구성한다.
export function workspaceDraft(
  snapshot: WorkspaceSnapshot,
  kind: WorkspaceDraftKind,
  id: string,
  schedule?: WorkspaceSchedule,
): PlanForm {
  // 공유 초안은 개인 정보와 사진·비용을 자동 선택하지 않는다.
  switch (kind) {
    case 'destinations':
      return destinationForm(snapshot, id);
    case 'expense':
      return {
        kind: 'expense',
        id,
        values: {
          title: schedule?.title || '',
          amount: '',
          currency: snapshot.trip.defaultCurrency,
          category: 'etc',
          isActual: 'true',
          scheduleId: schedule?.id || '',
        },
      };
    case 'plan-share':
    case 'record-share':
      return {
        kind: 'publish',
        id,
        values: {
          ...(kind === 'plan-share' ? { kind: 'plan' } : {}),
          title: snapshot.trip.title,
          body: '',
          scheduleIds: '',
          photoIds: '',
          includeCosts: 'false',
        },
      };
    case 'metadata':
      return {
        kind: 'metadata',
        id,
        values: {
          title: snapshot.trip.title,
          country: snapshot.trip.country,
          city: snapshot.trip.city,
          status: snapshot.trip.status,
        },
      };
    case 'period':
      return {
        kind: 'period',
        id,
        values: {
          startDate: snapshot.trip.startDate,
          endDate: snapshot.trip.endDate,
        },
      };
  }
}
