import {
  addFoundationChecklist,
  sendWorkspaceCommand,
  setFoundationChecklist,
} from '@wherego/api-client';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { checklistAddSchema } from '@wherego/validation';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { serverOptions } from './service';
import { type WorkspaceConfirmation } from './workspaceConfirmation';

// 준비물 등록과 완료 요청 행동을 구성한다.
export function useWorkspaceChecklistActions({
  snapshot,
  writable,
  running,
  pending,
  queueVersioned,
  userId,
  scanning,
  confirming,
  checklist,
  setChecklistError,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  writable: boolean;
  running: RefObject<boolean>;
  pending: RefObject<(() => Promise<unknown>) | null>;
  queueVersioned: (
    create: (version: number, key: string) => () => Promise<unknown>,
    usesForm?: boolean,
  ) => void;
  userId: string;
  scanning: boolean;
  confirming: RefObject<{
    details: WorkspaceConfirmation;
    fromForm: boolean;
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>;
  } | null>;
  checklist: string;
  setChecklistError: Dispatch<SetStateAction<string>>;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const check = function check(item: {
    id: string;
    isCompleted: boolean;
  }): void {
    // 완료 상태는 반전 요청 대신 명시값으로 보관하고 최신 조회 후에도 유지한다.
    return !snapshot || !writable || running.current || pending.current
      ? undefined
      : queueVersioned((version, key) => {
          // 최초로 선택한 완료 상태는 재시도 때 바꾸지 않는다.
          return () =>
            serverOptions(userId).then((options) => {
              // 기존 준비물 API도 동일 버전 계약을 사용한다.
              return setFoundationChecklist(
                options,
                snapshot.trip.id,
                item.id,
                !item.isCompleted,
                version,
                key,
              );
            });
        });
  };
  // 새 준비물을 실제 서버에 저장한다.
  const addCheck = function addCheck(): void {
    // 빈 제목과 동시 요청은 무시하며 입력한 제목은 재시도 동안 보관한다.
    return !snapshot ||
      running.current ||
      scanning ||
      pending.current ||
      confirming.current
      ? undefined
      : !checklistAddSchema.safeParse({ title: checklist }).success
        ? setChecklistError(
            '준비물 이름은 1~100자로 입력해 주세요. 공백만으로는 저장할 수 없어요.',
          )
        : (setChecklistError(''), queueChecklist(checklist.trim()));
  };
  // 준비물 제목을 캡처한 뒤 버전별 재시도 요청을 만든다.
  const queueChecklist = function queueChecklist(title: string): void {
    // 최신 버전을 읽어도 사용자가 작성한 준비물 제목을 변경하지 않는다.
    return queueVersioned((version, key) => {
      // 하나의 준비물 추가 요청만 실제 저장소로 전달한다.
      return () =>
        serverOptions(userId).then((options) => {
          // 저장된 여행 버전에 준비물을 추가한다.
          return addFoundationChecklist(
            options,
            snapshot!.trip.id,
            title,
            version,
            key,
          );
        });
    });
  };
  return { check, addCheck };
}
