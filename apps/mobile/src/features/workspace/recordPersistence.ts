import { useTripStore } from '@/stores/useTripStore';
import { type QueryClient } from '@tanstack/react-query';
import {
  FoundationClientError,
  foundationQueryKey,
  getWorkspace,
  sendWorkspaceCommand,
} from '@wherego/api-client';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { type WorkspaceCommand } from '@wherego/validation';
import * as Crypto from 'expo-crypto';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type PlanForm } from './forms';
import type { PendingRecord } from './RecordEditorScreen';
import { serverOptions } from './service';

// 계정·화면 수명 안에서 기록 저장과 새 조회를 처리한다.
export function useRecordPersistence({
  alive,
  userId,
  pending,
  version,
  snapshot,
  setRetryPending,
  setForm,
  setSaved,
  setNotice,
  cache,
  onAccessDenied,
  setError,
}: {
  alive: RefObject<boolean>;
  userId: string;
  pending: RefObject<PendingRecord | null>;
  version: RefObject<number>;
  snapshot: WorkspaceSnapshot;
  setRetryPending: Dispatch<SetStateAction<boolean>>;
  setForm: Dispatch<SetStateAction<PlanForm | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  cache: QueryClient;
  onAccessDenied: (failure: FoundationClientError) => void;
  setError: Dispatch<SetStateAction<string>>;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const current = function current(): boolean {
    // 계정 전환 뒤에는 이전 사용자의 결과를 적용하지 않는다.
    return alive.current && useTripStore.getState().currentUser?.id === userId;
  };
  const execute = async function execute(
    command: WorkspaceCommand,
  ): Promise<void> {
    // 응답이 유실된 요청은 원문·버전·멱등 키를 바꾸지 않고 재시도한다.
    const attempt = pending.current || {
      command,
      version: version.current,
      key: Crypto.randomUUID(),
    };
    pending.current = attempt;
    const options = await serverOptions(userId);
    if (!current()) return;
    const result = await sendWorkspaceCommand(
      options,
      snapshot.trip.id,
      attempt.version,
      attempt.command,
      attempt.key,
    );
    version.current = result.tripVersion;
    pending.current = null;
    if (!current()) return;
    setRetryPending(false);
    // 화면 비활성 중 대기할 수 있는 캐시 자동 갱신 대신 저장 원본을 직접 확인한다.
    const refreshed = await refreshSavedRecord(options);
    if (!current()) return;
    if (!refreshed) return;
    if (attempt.command.operation === 'schedule.save') {
      setForm(null);
      setSaved(true);
    } else
      setNotice('사진 변경을 저장했어요. 메모는 기록 저장을 눌러 마쳐 주세요.');
  };
  const refreshSavedRecord = async function refreshSavedRecord(
    options: Awaited<ReturnType<typeof serverOptions>>,
  ): Promise<boolean> {
    // 서버 확정 뒤 조회 실패를 저장 실패나 같은 사진 재등록으로 안내하지 않는다.
    try {
      const fresh = await getWorkspace(options, snapshot.trip.id);
      if (!current()) return false;
      cache.setQueryData(
        foundationQueryKey(userId, 'workspace', snapshot.trip.id),
        fresh,
      );
      return true;
    } catch (failure) {
      if (!current()) return false;
      if (
        failure instanceof FoundationClientError &&
        [401, 403, 404].includes(failure.status)
      ) {
        onAccessDenied(failure);
        return false;
      }
      if (current())
        setError(
          '변경은 저장했어요. 최신 기록을 다시 불러온 뒤 이어서 작성해 주세요.',
        );
      return false;
    }
  };
  return { current, execute };
}
