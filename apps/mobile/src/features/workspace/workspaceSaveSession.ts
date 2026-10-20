import { useTripStore } from '@/stores/useTripStore';
import { type QueryClient } from '@tanstack/react-query';
import { foundationQueryKey } from '@wherego/api-client';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type PlanForm } from './forms';
import {
  canReviseWorkspaceRequest,
  isWorkspaceVersionConflict,
} from './saveRecovery';
import { workspaceError } from './workspaceFailure';

// 저장 결과·재시도·충돌 복구의 요청 수명을 구성한다.
export function useWorkspaceSaveSession({
  cache,
  userId,
  pending,
  pendingRebase,
  pendingUsesForm,
  conflict,
  setConflicted,
  setHasPending,
  running,
  setBusy,
  setError,
  id,
  setForm,
}: {
  cache: QueryClient;
  userId: string;
  pending: RefObject<(() => Promise<unknown>) | null>;
  pendingRebase: RefObject<
    ((version: number) => () => Promise<unknown>) | null
  >;
  pendingUsesForm: RefObject<boolean>;
  conflict: RefObject<boolean>;
  setConflicted: Dispatch<SetStateAction<boolean>>;
  setHasPending: Dispatch<SetStateAction<boolean>>;
  running: RefObject<boolean>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  id: string | undefined;
  setForm: Dispatch<SetStateAction<PlanForm | null>>;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const refresh = function refresh(): Promise<unknown> {
    // 목록·상세·공개 피드의 낡은 결과를 무효화한다.
    return cache.invalidateQueries(
      { queryKey: ['wherego', userId] },
      { throwOnError: true },
    );
  };
  // 확인된 저장 성공 또는 입력 오류에서 대기 요청만 해제한다.
  const clearPending = function clearPending(): void {
    // 화면에 작성 중인 폼과 업로드된 원본은 그대로 둔다.
    return void ((pending.current = null),
    (pendingRebase.current = null),
    (pendingUsesForm.current = false),
    (conflict.current = false),
    setConflicted(false),
    setHasPending(false));
  };
  // 충돌 자료를 다시 읽되 작성한 폼을 보존한다.
  const reload = function reload(): void {
    // 저장 여부를 모르는 요청은 조회만으로 폐기하지 않으며 실패한 충돌 조회도 다시 시도할 수 있다.
    return running.current
      ? undefined
      : void ((running.current = true),
        setBusy(true),
        refresh()
          .then(() => {
            // 최신 조회가 성공한 버전 충돌에 한해 새 본문·버전으로 저장할 수 있다.
            return conflict.current
              ? recoverLatestConflict()
              : pending.current
                ? undefined
                : setError('');
          })
          .catch((failure: unknown) => {
            // 최신 자료 조회 실패를 저장 성공으로 안내하거나 재시도 요청을 버리지 않는다.
            return setError(
              conflict.current
                ? '동행의 최신 내용을 불러오지 못했어요. 작성한 내용은 유지돼요. 최신 내용 불러오기를 다시 눌러 주세요.'
                : workspaceError(failure),
            );
          })
          .finally(finishOperation));
  };
  // 최신 조회한 버전으로 사진·준비물 같은 폼 없는 명령도 다시 저장할 수 있게 준비한다.
  const recoverLatestConflict = function recoverLatestConflict(
    latest = cache.getQueryData<WorkspaceSnapshot>(
      foundationQueryKey(userId, 'workspace', id),
    ),
  ): void {
    // 사진을 다시 고르거나 업로드하지 않고 기존 등록 본문을 유지한다.
    return !latest
      ? setError(
          '동행의 최신 내용을 불러오지 못했어요. 최신 내용 불러오기를 다시 눌러 주세요.',
        )
      : !pendingUsesForm.current && pendingRebase.current
        ? void ((pending.current = pendingRebase.current(latest.trip.version)),
          (conflict.current = false),
          setConflicted(false),
          setError(
            '최신 내용을 불러왔어요. 다시 저장하기를 눌러 작성한 내용을 반영해 주세요.',
          ))
        : void (clearPending(), setError(''));
  };
  // 한 번 시작한 작업이 끝난 뒤에만 다음 저장·사진 선택을 허용한다.
  const finishOperation = function finishOperation(): void {
    // React 렌더링 이전의 연속 클릭도 같은 잠금으로 차단한다.
    return void ((running.current = false), setBusy(false));
  };
  // 확인된 성공 이후 화면과 조회 자료를 갱신한다.
  const saveSucceeded = function saveSucceeded(): Promise<unknown> | undefined {
    // 이전 계정의 비동기 완료가 현재 계정에 화면 전환이나 캐시 변경을 만들지 않는다.
    return useTripStore.getState().currentUser?.id !== userId
      ? undefined
      : (clearPending(),
        setForm(null),
        refresh().catch(() => {
          // 저장 완료와 후속 조회 실패를 구분해 동일 기록의 재생성을 막는다.
          return setError(
            '저장은 완료했지만 최신 내용을 불러오지 못했어요. 여행 다시 불러오기를 눌러 주세요.',
          );
        }));
  };
  // 거부된 입력과 응답을 잃은 저장을 다른 복구 상태로 안내한다.
  const saveFailed = function saveFailed(failure: unknown): void {
    // 계정이 바뀐 화면에는 이전 요청의 오류를 표시하지 않는다.
    return useTripStore.getState().currentUser?.id !== userId
      ? undefined
      : void (canReviseWorkspaceRequest(failure) ? clearPending() : undefined,
        (conflict.current = isWorkspaceVersionConflict(failure)),
        setConflicted(conflict.current),
        setError(workspaceError(failure)));
  };
  // 저장 중 또는 응답을 잃은 요청은 같은 클로저로 재시도한다.
  const execute = function execute(task: () => Promise<unknown>): void {
    // 동기 잠금으로 중복 요청을 막고 동기 예외도 동일 실패 복구로 연결한다.
    return running.current
      ? undefined
      : void ((running.current = true),
        (pending.current = task),
        setHasPending(true),
        setBusy(true),
        setError(''),
        Promise.resolve()
          .then(task)
          .then(saveSucceeded)
          .catch(saveFailed)
          .finally(finishOperation));
  };
  return { refresh, execute, clearPending, finishOperation, reload };
}
