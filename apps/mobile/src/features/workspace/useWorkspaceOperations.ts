import { useTripStore } from '@/stores/useTripStore';
import type { useWorkspaceEditorState } from './useWorkspaceEditorState';
import type { useWorkspaceNavigationState } from './useWorkspaceNavigationState';
import { useWorkspaceChecklistActions } from './workspaceChecklistActions';
import { useWorkspaceCommands } from './workspaceCommands';
import { useWorkspaceFormActions } from './workspaceFormActions';
import { useWorkspaceMediaActions } from './workspaceMediaActions';
import { createWorkspaceSaveSession as useWorkspaceSaveSession } from './workspaceSaveSession';
import { createWorkspaceEditorActions } from './workspaceEditorActions';

type OperationOptions = Pick<
  Parameters<typeof useWorkspaceMediaActions>[0],
  'user' | 'userId' | 'snapshot'
> &
  Pick<Parameters<typeof useWorkspaceSaveSession>[0], 'cache' | 'id'> &
  Pick<
    Parameters<typeof useWorkspaceFormActions>[0],
    'router' | 'importing'
  > & {
    editor: ReturnType<typeof useWorkspaceEditorState>;
    navigation: ReturnType<typeof useWorkspaceNavigationState>;
    writable: boolean;
  };

// 모든 작성 행동이 같은 잠금·확인창·대기 요청을 사용하도록 연결한다.
export function useWorkspaceOperations({
  editor,
  navigation,
  user,
  userId,
  snapshot,
  cache,
  id,
  router,
  importing,
  writable,
}: OperationOptions) {
  const session = useWorkspaceSaveSession({
    ...editor,
    isCurrentAccount: () => useTripStore.getState().currentUser?.id === userId,
    cache,
    userId,
    id,
  });
  const commands = useWorkspaceCommands({
    ...editor,
    snapshot,
    cache,
    userId,
    id,
    refresh: session.refresh,
    execute: session.execute,
  });
  const formActions = useWorkspaceFormActions({
    ...editor,
    ...navigation,
    ...session,
    snapshot,
    command: commands.command,
    userId,
    router,
    importing,
  });
  const mediaActions = useWorkspaceMediaActions({
    ...editor,
    user,
    snapshot,
    userId,
    finishOperation: session.finishOperation,
    command: commands.command,
  });
  const checklistActions = useWorkspaceChecklistActions({
    ...editor,
    snapshot,
    writable,
    userId,
    queueVersioned: commands.queueVersioned,
  });
  const editorActions = createWorkspaceEditorActions({
    ...editor,
    command: commands.command,
    receipt: mediaActions.receipt,
    execute: session.execute,
    snapshot,
    userId,
    router,
  });
  return {
    ...session,
    ...commands,
    ...formActions,
    ...mediaActions,
    ...checklistActions,
    ...editorActions,
  };
}
