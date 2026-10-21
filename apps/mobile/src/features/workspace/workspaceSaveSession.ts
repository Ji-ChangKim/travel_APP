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
export function createWorkspaceSaveSession({
  isCurrentAccount,
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
  isCurrentAccount: () => boolean;
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
  function refresh(): Promise<unknown> {
    return cache.invalidateQueries(
      { queryKey: ['wherego', userId] },
      { throwOnError: true },
    );
  }

  function clearPending(): void {
    // 결과가 확정된 요청만 해제하며 편집 중인 폼과 업로드 원본은 보존한다.
    pending.current = null;
    pendingRebase.current = null;
    pendingUsesForm.current = false;
    conflict.current = false;
    setConflicted(false);
    setHasPending(false);
  }

  function finishOperation(): void {
    running.current = false;
    setBusy(false);
  }

  function recoverLatestConflict(): void {
    const latest = cache.getQueryData<WorkspaceSnapshot>(
      foundationQueryKey(userId, 'workspace', id),
    );
    if (!latest) {
      setError(
        '동행의 최신 내용을 불러오지 못했어요. 최신 내용 불러오기를 다시 눌러 주세요.',
      );
      return;
    }
    if (!pendingUsesForm.current && pendingRebase.current) {
      // 파일 업로드와 명령 본문은 재사용하고 확인한 최신 버전에만 새 키를 발급한다.
      pending.current = pendingRebase.current(latest.trip.version);
      conflict.current = false;
      setConflicted(false);
      setError(
        '최신 내용을 불러왔어요. 다시 저장하기를 눌러 작성한 내용을 반영해 주세요.',
      );
      return;
    }
    clearPending();
    setError('');
  }

  function reload(): void {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    void refresh()
      .then(() => {
        if (!isCurrentAccount()) return;
        if (conflict.current) recoverLatestConflict();
        else if (!pending.current) setError('');
      })
      .catch((failure: unknown) => {
        if (!isCurrentAccount()) return;
        setError(
          conflict.current
            ? '동행의 최신 내용을 불러오지 못했어요. 작성한 내용은 유지돼요. 최신 내용 불러오기를 다시 눌러 주세요.'
            : workspaceError(failure),
        );
      })
      .finally(finishOperation);
  }

  async function saveSucceeded(): Promise<void> {
    if (!isCurrentAccount()) return;
    clearPending();
    setForm(null);
    try {
      await refresh();
    } catch {
      // 저장 성공 뒤 조회 실패는 같은 기록을 다시 만들 근거가 되지 않는다.
      if (isCurrentAccount())
        setError(
          '저장은 완료했지만 최신 내용을 불러오지 못했어요. 여행 다시 불러오기를 눌러 주세요.',
        );
    }
  }

  function saveFailed(failure: unknown): void {
    if (!isCurrentAccount()) return;
    if (canReviseWorkspaceRequest(failure)) clearPending();
    conflict.current = isWorkspaceVersionConflict(failure);
    setConflicted(conflict.current);
    setError(workspaceError(failure));
  }

  function execute(task: () => Promise<unknown>): void {
    if (running.current) return;
    running.current = true;
    pending.current = task;
    setHasPending(true);
    setBusy(true);
    setError('');
    // 동기 예외도 비동기 실패와 같은 경로에서 처리하고 응답 유실 시 원래 요청을 보존한다.
    void Promise.resolve()
      .then(task)
      .then(saveSucceeded)
      .catch(saveFailed)
      .finally(finishOperation);
  }

  return { refresh, execute, clearPending, finishOperation, reload };
}
