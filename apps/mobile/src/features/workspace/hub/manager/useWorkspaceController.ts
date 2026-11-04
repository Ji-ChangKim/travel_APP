import { useWorkspaceOperations } from './useWorkspaceOperations';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';
import { useWorkspaceNavigationState } from './useWorkspaceNavigationState';
import { useWorkspaceData } from './useWorkspaceData';
import { useTripStore } from '@/stores/useTripStore';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { scheduleForm, type PlanForm } from '../../shared/model/forms';
import { savedReceiptForm, receiptForm } from '../../receipt/model/receiptFlow';
import { useSharedSchedule } from '../../schedule/manager/useSharedSchedule';
import { useTripDateRefresh } from '../../shared/manager/useTripDateRefresh';
import { useWorkspaceScreenActions } from '../model/workspaceScreenActions';
import { useEffect, useRef } from 'react';
import { authReturn, type AuthReturn } from '@/features/auth/model/authReturn';
import { rememberCreation } from '../../planning/model/creationAuthHandoff';
import { continueFormAfterPreserving } from '../../schedule/ui/scheduleExitGuard';

// 여행 조회·명령·충돌·폼 상태를 관리하며 화면을 그리지 않는다.
export function useWorkspaceController({
  creating,
  importing,
  initialForm,
}: {
  creating: boolean;
  importing: boolean;
  initialForm?: PlanForm;
}) {
  // 서버 자료의 기준 계정과 현재 경로를 구독한다.
  useTripDateRefresh();
  const user = useTripStore((state) => {
    // 게스트는 서버 작성 권한을 갖지 않는다.
    return state.currentUser;
  });
  const { id, section, destination, mode, localDate, intentKey, targetRef } =
    useLocalSearchParams<{
      id?: string;
      section?: string;
      destination?: string;
      mode?: string;
      localDate?: string;
      intentKey?: string;
      targetRef?: string;
    }>();
  const router = useRouter();
  const cache = useQueryClient();
  const userId = user?.id || '';
  const editor = useWorkspaceEditorState({
    creating,
    destination,
    mode,
    initialForm,
  });
  const navigation = useWorkspaceNavigationState(section);
  const { trips, workspace, snapshot, writable, owner } = useWorkspaceData(
    userId,
    id,
    creating,
  );
  const setSelectedDay = navigation.setSelectedDay;
  const restoredDay = useRef('');
  useEffect(() => {
    const key = `${userId}:${id}:${localDate}`;
    if (!localDate || !snapshot || restoredDay.current === key) return;
    const day = snapshot.days.find((item) => item.tripDate === localDate);
    if (day) {
      restoredDay.current = key;
      setSelectedDay(day.id);
    }
  }, [snapshot, localDate, setSelectedDay, userId, id]);
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
  function login(intent?: AuthReturn['intentKey'], target?: string): void {
    if (creating && editor.form?.kind === 'trip') {
      const handoff = rememberCreation(
        editor.form,
        editor.form.values._creationStep || '',
      );
      continueFormAfterPreserving(() =>
        router.push({
          pathname: '/login',
          params: authReturn('new-trip', destination, handoff),
        }),
      );
      return;
    }
    const date =
      snapshot?.days.find((day) => day.id === navigation.selectedDay)
        ?.tripDate || localDate;
    router.push({
      pathname: '/login',
      params: authReturn('trip', undefined, id, {
        localDate: date,
        intentKey: intent,
        targetRef: target,
      }),
    });
  }
  const resumed = useRef('');
  useEffect(() => {
    const key = `${userId}:${id}:${intentKey}:${targetRef}`;
    if (
      !snapshot ||
      !user ||
      user.authProvider === 'guest' ||
      !intentKey ||
      resumed.current === key
    )
      return;
    resumed.current = key;
    if (intentKey === 'publish' || intentKey === 'publish-record') {
      navigation.setActiveSection('share');
      operations.openDraft(
        intentKey === 'publish' ? 'plan-share' : 'record-share',
      );
    } else if (intentKey === 'invite')
      navigation.setActiveSection('companions');
    else if (intentKey === 'scan') {
      navigation.setActiveSection('expenses');
      if (targetRef && snapshot.media.some((media) => media.id === targetRef))
        editor.setForm(receiptForm(snapshot, targetRef, undefined, 'manual'));
    }
  }, [
    snapshot,
    user,
    userId,
    id,
    intentKey,
    targetRef,
    operations,
    navigation,
    editor,
  ]);

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
    login,
    userId,
    form: editor.form,
    setForm: editor.setForm,
    busy: editor.busy,
    draftSaving: editor.draftSaving,
    setDraftSaving: editor.setDraftSaving,
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
    receipt: (mediaId: string) =>
      user?.authProvider === 'guest'
        ? Promise.resolve(login('scan', mediaId))
        : operations.receipt(mediaId),
    captureReceipt: operations.captureReceipt,
    photo: operations.photo,
    check: operations.check,
    addCheck: operations.addCheck,
    edit: operations.edit,
    openDraft: (...args: Parameters<typeof operations.openDraft>) =>
      user?.authProvider === 'guest' &&
      (args[0] === 'plan-share' || args[0] === 'record-share')
        ? login(args[0] === 'plan-share' ? 'publish' : 'publish-record')
        : operations.openDraft(...args),
    changeChecklist: operations.changeChecklist,
    retrySave: operations.retrySave,
    retryReceipt: (mediaId: string) =>
      user?.authProvider === 'guest'
        ? login('scan', mediaId)
        : operations.retryReceipt(mediaId),
    conflicted: editor.conflicted,
    reloadLabel: editor.conflicted
      ? '최신 내용 불러오기'
      : '여행 다시 불러오기',
    invite: (...args: Parameters<typeof operations.invite>) =>
      user?.authProvider === 'guest'
        ? login('invite')
        : operations.invite(...args),
    closeCreation: operations.closeCreation,
    creating,
    importing,
  };
}
