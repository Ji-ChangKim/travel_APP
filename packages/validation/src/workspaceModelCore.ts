import type { CommunityPost, WorkspaceSnapshot } from '@wherego/domain';
import { validTravelLeg } from '@wherego/domain';

// 로컬 저장과 서버 저장이 같은 여행 규칙 오류를 공유한다.
export class WorkspaceModelError extends Error {
  // 내부 서버 상태 없이 공개 도메인 오류 코드만 보관한다.
  constructor(
    readonly code: 'ROLE_FORBIDDEN' | 'TRIP_ARCHIVED' | 'VALIDATION_FAILED',
  ) {
    // 플랫폼별 저장 계층이 오류를 사용자 안내로 변환한다.
    super(code);
  }
}

// 유효하지 않은 여행 변경 후보를 중단한다.
export function rejectRequest(code: WorkspaceModelError['code']): never {
  // 서버와 로컬에서 동일하게 저장을 거부한다.
  throw new WorkspaceModelError(code);
}

export type Snapshot = WorkspaceSnapshot;

// 플랫폼이 제공하는 보안 UUID 생성기를 요청마다 전달한다.
export type WorkspaceId = () => string;

export type Change = {
  snapshot: Snapshot;
  result: Record<string, unknown>;
  post?: CommunityPost | null;
  invite?: {
    id: string;
    token: string;
    role: 'editor' | 'viewer';
    expires: number;
  };
};

export function saveItem<T extends { id: string }>(items: T[], item: T): T[] {
  return [...items.filter((previous) => previous.id !== item.id), item];
}

export function without<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function validDay(snapshot: Snapshot, id?: string): boolean {
  // 날짜 없는 독립 비용은 허용하되 다른 여행의 DAY를 연결할 수 없다.
  return !id || snapshot.days.some((day) => day.id === id);
}

export function validSchedule(
  snapshot: Snapshot,
  id?: string,
  day?: string,
): boolean {
  // 독립 기록은 허용하되 연결한 일정과 DAY는 같은 여행·날짜여야 한다.
  return (
    !id ||
    snapshot.itinerary.some(
      (item) => item.id === id && (!day || item.dayId === day),
    )
  );
}

// 변경 필드만 합성해 저장 후보를 만든다.
export function changed(
  s: Snapshot,
  patch: Partial<Snapshot>,
  result: Record<string, unknown> = {},
  extra: Partial<Change> = {},
): Change {
  // 버전 증가는 저장 계층이 CAS 시 확정한다.
  const snapshot = { ...s, ...patch };
  return {
    snapshot: {
      ...snapshot,
      ...(snapshot.travelLegs
        ? {
            travelLegs: snapshot.travelLegs.filter((leg) =>
              validTravelLeg(snapshot, leg),
            ),
          }
        : {}),
    },
    result,
    ...extra,
  };
}
