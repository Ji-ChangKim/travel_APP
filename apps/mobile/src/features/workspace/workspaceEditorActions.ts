import { useTripStore } from '@/stores/useTripStore';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import * as Crypto from 'expo-crypto';
import type { ImperativeRouter } from 'expo-router';
import type { PlanForm } from './forms';
import { requestScheduleExit } from './scheduleExitGuard';
import { shareInvite } from './service';
import { workspaceDraft, type WorkspaceDraftKind } from './workspaceDrafts';
import { workspaceError } from './workspaceFailure';
import type { useWorkspaceEditorState } from './useWorkspaceEditorState';
import type { useWorkspaceCommands } from './workspaceCommands';
import type { useWorkspaceMediaActions } from './workspaceMediaActions';
import type { createWorkspaceSaveSession } from './workspaceSaveSession';

type EditorActionsOptions = Pick<
  ReturnType<typeof useWorkspaceEditorState>,
  | 'busy'
  | 'pending'
  | 'running'
  | 'setFeedback'
  | 'setError'
  | 'setForm'
  | 'setChecklist'
  | 'setChecklistError'
> &
  Pick<ReturnType<typeof useWorkspaceCommands>, 'command'> &
  Pick<ReturnType<typeof useWorkspaceMediaActions>, 'receipt'> &
  Pick<ReturnType<typeof createWorkspaceSaveSession>, 'execute'> & {
    snapshot: WorkspaceSnapshot | undefined;
    userId: string;
    router: ImperativeRouter;
  };

// 화면은 대기 요청의 참조를 직접 읽지 않고 이 행동을 통해서만 편집한다.
export function createWorkspaceEditorActions({
  busy,
  pending,
  running,
  setFeedback,
  setError,
  setForm,
  setChecklist,
  setChecklistError,
  command,
  receipt,
  execute,
  snapshot,
  userId,
  router,
}: EditorActionsOptions) {
  // 편집 모달 하나를 연다.
  function edit(next: PlanForm): void {
    // 재시도 중인 요청과 새 폼을 섞지 않는다.
    if (busy || pending.current) return;
    setFeedback({ fields: {}, attempt: 0 });
    setError('');
    setForm(next);
  }
  // 허용한 역할로 초대를 저장한 뒤 공유 시트를 연다.
  function invite(role: 'viewer' | 'editor'): void {
    // 토큰은 성공 응답에서만 공유하며 목록에 저장하지 않는다.
    command({ operation: 'invite.create', input: { role } }, (result) => {
      // 카카오톡·메시지 선택은 OS 공유 시트가 담당한다.
      return shareInvite(snapshot!.trip.title, result.token!);
    });
  }
  // 생성 페이지에서 이전 화면으로 돌아간다.
  function closeCreation(): void {
    // 직접 링크로 열어도 내 여행 목록으로 돌아갈 수 있게 한다.
    return requestScheduleExit(() => {
      // 새 여행을 버릴지 확인한 뒤 원래 화면으로 돌아간다.
      return router.canGoBack() ? router.back() : router.replace('/(tabs)');
    });
  }

  // 초안 데이터와 고유 ID를 표현 계층에서 생성하지 않게 한다.
  function openDraft(
    kind: WorkspaceDraftKind,
    schedule?: WorkspaceSchedule,
  ): void {
    // 실제 조회된 여행과 선택 일정으로만 기본 입력을 구성한다.
    return snapshot
      ? edit(workspaceDraft(snapshot, kind, Crypto.randomUUID(), schedule))
      : undefined;
  }
  // 저장이 끝나지 않은 요청과 준비물 입력을 섞지 않는다.
  function changeChecklist(value: string): void {
    // 동기 잠금과 대기 요청을 같은 컨트롤러에서 검사한다.
    if (running.current || pending.current) return;
    setChecklist(value);
    setChecklistError('');
  }
  // 결과 미확인 저장은 원래 요청과 키로만 재개한다.
  function retrySave(): void {
    // 표현 계층에 저장 클로저나 잠금 참조를 노출하지 않는다.
    if (pending.current) execute(pending.current);
  }
  // 영수증 인식 재시도의 예외를 현재 화면 안내로 전달한다.
  function retryReceipt(mediaId: string): void {
    // 비동기 예외 처리도 화면 JSX가 아닌 작업 계층에서 수행한다.
    void receipt(mediaId).catch((failure: unknown) => {
      // 계정 전환 뒤에는 이전 화면의 오류를 적용하지 않는다.
      if (useTripStore.getState().currentUser?.id === userId)
        setError(workspaceError(failure));
    });
  }

  return {
    edit,
    invite,
    closeCreation,
    openDraft,
    changeChecklist,
    retrySave,
    retryReceipt,
  };
}
