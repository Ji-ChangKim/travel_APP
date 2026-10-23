import { useWorkspaceOperations } from './useWorkspaceOperations';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';
import { useWorkspaceNavigationState } from './useWorkspaceNavigationState';
import { useWorkspaceData } from './useWorkspaceData';
import { useTripStore } from '@/stores/useTripStore';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { scheduleForm } from './forms';
import { savedReceiptForm } from './receiptFlow';
import { useSharedSchedule } from './useSharedSchedule';
import { useTripDateRefresh } from './useTripDateRefresh';
import { useWorkspaceScreenActions } from './workspaceScreenActions';

// 여행 조회·명령·충돌·폼 상태를 관리하며 화면을 그리지 않는다.
export function useWorkspaceController({
  creating,
  importing,
}: {
  creating: boolean;
  importing: boolean;
}) {
  // 서버 자료의 기준 계정과 현재 경로를 구독한다.
  useTripDateRefresh();
  const user = useTripStore((state) => {
    // 게스트는 서버 작성 권한을 갖지 않는다.
    return state.currentUser;
  });
  const { id, section, destination, mode } = useLocalSearchParams<{
    id?: string;
    section?: string;
    destination?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const cache = useQueryClient();
  const userId = user?.id || '';
  const editor = useWorkspaceEditorState({ creating, destination, mode });
  const navigation = useWorkspaceNavigationState(section);
  const { trips, workspace, snapshot, writable, owner } = useWorkspaceData(
    userId,
    id,
    creating,
  );
  useSharedSchedule(
    snapshot,
    writable,
    importing,
    editor.setForm,
    editor.setError,
  );
  const operations = useWorkspaceOperations({
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
  });

  // 명령 본문과 초안 생성은 화면 이벤트 바인딩과 분리한다.
  const actions = useWorkspaceScreenActions({
    snapshot,
    command: operations.command,
    edit: operations.edit,
    removeRegisteredImage: operations.removeRegisteredImage,
    createSchedule: scheduleForm,
    createReceiptEdit: savedReceiptForm,
  });

  // 표현 계층에는 현재 상태와 이미 권한을 확인하는 행동만 전달한다.
  return {
    actions,
    user,
    id,
    section,
    destination,
    router,
    userId,
    form: editor.form,
    setForm: editor.setForm,
    busy: editor.busy,
    scanning: editor.scanning,
    confirmation: editor.confirmation,
    showReceiptCapture: editor.showReceiptCapture,
    setShowReceiptCapture: editor.setShowReceiptCapture,
    hasPending: editor.hasPending,
    error: editor.error,
    feedback: editor.feedback,
    checklistError: editor.checklistError,
    checklist: editor.checklist,
    activeSection: navigation.activeSection,
    setActiveSection: navigation.setActiveSection,
    selectedDay: navigation.selectedDay,
    setSelectedDay: navigation.setSelectedDay,
    selectedScheduleId: navigation.selectedScheduleId,
    setSelectedScheduleId: navigation.setSelectedScheduleId,
    courseDay: navigation.courseDay,
    setCourseDay: navigation.setCourseDay,
    showTripMore: navigation.showTripMore,
    setShowTripMore: navigation.setShowTripMore,
    trips,
    workspace,
    snapshot,
    writable,
    owner,
    reload: operations.reload,
    command: operations.command,
    cancelConfirmation: operations.cancelConfirmation,
    confirmCommand: operations.confirmCommand,
    removeRegisteredImage: operations.removeRegisteredImage,
    save: operations.save,
    invalidForm: operations.invalidForm,
    change: operations.change,
    receipt: operations.receipt,
    captureReceipt: operations.captureReceipt,
    photo: operations.photo,
    check: operations.check,
    addCheck: operations.addCheck,
    edit: operations.edit,
    openDraft: operations.openDraft,
    changeChecklist: operations.changeChecklist,
    retrySave: operations.retrySave,
    retryReceipt: operations.retryReceipt,
    conflicted: editor.conflicted,
    reloadLabel: editor.conflicted
      ? '최신 내용 불러오기'
      : '여행 다시 불러오기',
    invite: operations.invite,
    closeCreation: operations.closeCreation,
    creating,
    importing,
  };
}
