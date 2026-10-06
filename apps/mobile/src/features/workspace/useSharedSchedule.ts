import { useEffect } from 'react';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { sharedScheduleForm, type PlanForm } from './forms';
import { pendingMapsShare, clearPendingMapsShare } from './mapsShare';

// 시작한 비동기 작업과 화면 해제 정리 함수를 연결한다.
function importCleanup(
  _task: Promise<unknown>,
  cleanup: () => void,
): () => void {
  // effect는 Promise가 아니라 동기 종료 함수를 반환한다.
  return cleanup;
}

// 공유 후보는 사용자가 확인할 새 일정 폼으로만 인계한다.
function loadSharedSchedule(
  snapshot: WorkspaceSnapshot,
  onForm: (form: PlanForm) => void,
  onError: (message: string) => void,
  controller: AbortController,
): Promise<unknown> {
  // 해제한 화면은 저장 후보를 삭제하거나 새 폼을 열지 않는다.
  return pendingMapsShare()
    .then((text) => {
      // 새 폼에 후보를 적용한 뒤 임시 저장소를 정리한다.
      return text && !controller.signal.aborted
        ? Promise.resolve(onForm(sharedScheduleForm(snapshot, text))).then(
            clearPendingMapsShare,
          )
        : undefined;
    })
    .catch(() => {
      // 저장소 오류에서도 여행 조회를 계속 사용할 수 있다.
      return controller.signal.aborted
        ? undefined
        : onError(
            '공유한 링크를 불러오지 못했습니다. 일정 추가에서 다시 붙여 넣어 주세요.',
          );
    });
}

// 권한이 확인된 여행에만 가져오기 요청을 구독한다.
function subscribeSharedSchedule(
  snapshot: WorkspaceSnapshot | undefined,
  writable: boolean,
  importing: boolean,
  onForm: (form: PlanForm) => void,
  onError: (message: string) => void,
  controller: AbortController,
): () => void {
  // 개발 모드 effect 재구독도 취소되지 않은 후보를 다시 읽을 수 있다.
  return importCleanup(
    importing && snapshot && writable
      ? loadSharedSchedule(snapshot, onForm, onError, controller)
      : Promise.resolve(),
    () => {
      // 이전 계정·여행 화면에 늦은 공유 결과가 적용되지 않게 한다.
      return controller.abort();
    },
  );
}

// 여행 스냅샷과 공유 후보를 같은 화면 생명주기로 연결한다.
export function useSharedSchedule(
  snapshot: WorkspaceSnapshot | undefined,
  writable: boolean,
  importing: boolean,
  onForm: (form: PlanForm) => void,
  onError: (message: string) => void,
): void {
  // 쓰기 권한이 없거나 조회 중이면 공유 폼을 만들지 않는다.
  return useEffect(() => {
    // 현재 effect만 공유 후보를 적용하도록 취소 문맥을 분리한다.
    return subscribeSharedSchedule(
      snapshot,
      writable,
      importing,
      onForm,
      onError,
      new AbortController(),
    );
  }, [snapshot, writable, importing, onForm, onError]);
}
