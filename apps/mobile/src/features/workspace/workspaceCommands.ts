import { UserFacingError } from '@/services/userFacingError';
import { useTripStore } from '@/stores/useTripStore';
import { type QueryClient } from '@tanstack/react-query';
import { foundationQueryKey, sendWorkspaceCommand } from '@wherego/api-client';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { type WorkspaceCommand } from '@wherego/validation';
import * as Crypto from 'expo-crypto';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { removeImage, serverOptions } from './service';
import {
  canConfirmWorkspaceAction,
  workspaceConfirmation,
  type WorkspaceConfirmation,
} from './workspaceConfirmation';

// 권한과 확인창을 거쳐 같은 버전·키로 명령을 구성한다.
export function useWorkspaceCommands({
  snapshot,
  running,
  pending,
  confirming,
  setConfirmation,
  cache,
  userId,
  id,
  refresh,
  setError,
  pendingUsesForm,
  pendingRebase,
  execute,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  running: RefObject<boolean>;
  pending: RefObject<(() => Promise<unknown>) | null>;
  confirming: RefObject<{
    details: WorkspaceConfirmation;
    fromForm: boolean;
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>;
  } | null>;
  setConfirmation: Dispatch<SetStateAction<WorkspaceConfirmation | null>>;
  cache: QueryClient;
  userId: string;
  id: string | undefined;
  refresh: () => Promise<unknown>;
  setError: Dispatch<SetStateAction<string>>;
  pendingUsesForm: RefObject<boolean>;
  pendingRebase: RefObject<
    ((version: number) => () => Promise<unknown>) | null
  >;
  execute: (task: () => Promise<unknown>) => void;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const command = function command(
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
    fromForm = false,
  ): void {
    // 파괴적 명령은 실제 요청을 만들기 전에 명시적 확인을 받는다.
    return !snapshot || running.current || pending.current || confirming.current
      ? undefined
      : prepareCommand(value, after, fromForm);
  };
  // 일반 저장과 삭제 확인을 명령 종류에 따라 나눈다.
  const prepareCommand = function prepareCommand(
    value: WorkspaceCommand,
    after:
      | ((
          result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
        ) => Promise<unknown>)
      | undefined,
    fromForm: boolean,
    details = workspaceConfirmation(snapshot!, value),
  ): void {
    // 확인 대상은 현재 여행 버전과 같은 명령 본문을 유지한다.
    return details
      ? void ((confirming.current = { details, after, fromForm }),
        setConfirmation(details))
      : queueCommand(value, after, fromForm);
  };
  // 취소는 선택한 확인 정보만 지우며 저장 요청을 만들지 않는다.
  const cancelConfirmation = function cancelConfirmation(): void {
    // 닫기와 Android 뒤로도 같은 취소 경로를 사용한다.
    return void ((confirming.current = null), setConfirmation(null));
  };
  // 확인 당시와 같은 계정·버전·대상일 때만 삭제를 진행한다.
  const confirmCommand = function confirmCommand(): void {
    // 중복 확인 탭은 참조를 먼저 비워 차단한다.
    return applyConfirmedCommand(
      confirming.current,
      cache.getQueryData<WorkspaceSnapshot>(
        foundationQueryKey(userId, 'workspace', id),
      ),
    );
  };
  // 사진 등록 삭제 성공과 원본 파일 정리 실패를 구분해 재시도한다.
  const removeRegisteredImage = function removeRegisteredImage(
    path?: string,
  ): Promise<void> {
    // 등록 삭제는 이미 확정됐으므로 최신 목록을 읽고 같은 요청 키로 정리만 재개한다.
    return removeImage(userId, path).catch(() => {
      // 목록 조회 실패가 원본 정리 재시도 요청을 폐기하지 않게 한다.
      return refresh()
        .catch(() => {
          // 삭제 확정 결과는 유지하고 다음 재시도에서 목록을 다시 읽는다.
          return undefined;
        })
        .then(() => {
          // 성공한 등록 삭제를 다시 생성하거나 미저장으로 안내하지 않는다.
          return Promise.reject(
            new UserFacingError(
              '사진 등록은 삭제했지만 원본 파일을 정리하지 못했어요. 다시 저장하기를 눌러 마무리해 주세요.',
            ),
          );
        });
    });
  };
  // 최신 원본과 확인한 명령을 대조한 뒤 한 번 실행한다.
  const applyConfirmedCommand = function applyConfirmedCommand(
    action: typeof confirming.current,
    latest: WorkspaceSnapshot | undefined,
  ): void {
    // 참조를 비우고 검증하므로 같은 확인을 두 번 실행하지 않는다.
    return !action
      ? undefined
      : void (cancelConfirmation(),
        useTripStore.getState().currentUser?.id === userId &&
        latest &&
        canConfirmWorkspaceAction(action.details, latest)
          ? queueCommand(action.details.command, action.after, action.fromForm)
          : setError(
              '여행 내용이 바뀌었어요. 최신 내용을 불러온 뒤 대상을 다시 확인해 주세요.',
            ));
  };
  // 사용자 확인을 마친 명령을 기존 멱등·버전 저장 경로로 전달한다.
  const queueCommand = function queueCommand(
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
    fromForm = false,
  ): void {
    // 버전 충돌을 확인한 명시적 재조회에서만 새 키와 버전을 적용한다.
    return !snapshot || pending.current || running.current
      ? undefined
      : queueVersioned((version, key) => {
          // 명령 본문과 업로드 원본은 최초 입력 그대로 유지한다.
          return () =>
            serverOptions(userId)
              .then((options) => {
                // 서버에서 역할·부모 ID·버전을 검사한다.
                return sendWorkspaceCommand(
                  options,
                  snapshot.trip.id,
                  version,
                  value,
                  key,
                );
              })
              .then((result) => {
                // 공유 등 저장 후 사용자 동작은 성공 결과로만 수행한다.
                return after &&
                  useTripStore.getState().currentUser?.id === userId
                  ? after(result)
                  : result;
              });
        }, fromForm);
  };
  // 사용자 확인을 거친 버전 변경에 사용할 업무 요청 생성기만 보관한다.
  const queueVersioned = function queueVersioned(
    create: (version: number, key: string) => () => Promise<unknown>,
    usesForm = false,
  ): void {
    // 일반 응답 유실 재시도에서는 생성기를 다시 부르지 않아 키와 본문을 고정한다.
    return void ((pendingUsesForm.current = usesForm),
    (pendingRebase.current = (version) => {
      // 실제 버전 충돌의 최신 조회가 성공한 때만 새 키를 발급한다.
      return create(version, Crypto.randomUUID());
    }),
    execute(pendingRebase.current(snapshot!.trip.version)));
  };
  return {
    command,
    queueVersioned,
    cancelConfirmation,
    confirmCommand,
    removeRegisteredImage,
  };
}
