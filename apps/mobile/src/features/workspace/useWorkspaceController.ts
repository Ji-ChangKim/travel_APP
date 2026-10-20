import { useTripStore } from '@/stores/useTripStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  foundationQueryKey,
  getWorkspace,
  listServerTrips,
  sendWorkspaceCommand,
} from '@wherego/api-client';
import type { WorkspaceSchedule } from '@wherego/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type FormFeedbackState } from './formFeedback';
import { newTripForm, scheduleForm, type PlanForm } from './forms';
import { savedReceiptForm } from './receiptFlow';
import { requestScheduleExit, useScheduleExitGuard } from './scheduleExitGuard';
import { serverOptions, shareInvite } from './service';
import { useSharedSchedule } from './useSharedSchedule';
import { useTripDateRefresh } from './useTripDateRefresh';
import { useWorkspaceChecklistActions } from './workspaceChecklistActions';
import { useWorkspaceCommands } from './workspaceCommands';
import { type WorkspaceConfirmation } from './workspaceConfirmation';
import { workspaceDraft, type WorkspaceDraftKind } from './workspaceDrafts';
import { workspaceError } from './workspaceFailure';
import { useWorkspaceFormActions } from './workspaceFormActions';
import { useWorkspaceMediaActions } from './workspaceMediaActions';
import { useWorkspaceSaveSession } from './workspaceSaveSession';
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
  const [form, setForm] = useState<PlanForm | null>(
    creating ? () => newTripForm(destination, mode === 'record') : null,
  );
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmation, setConfirmation] =
    useState<WorkspaceConfirmation | null>(null);
  const confirming = useRef<null | {
    details: WorkspaceConfirmation;
    fromForm: boolean;
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>;
  }>(null);
  const [showReceiptCapture, setShowReceiptCapture] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  useScheduleExitGuard(
    form,
    busy || scanning || hasPending || Boolean(confirmation),
    setForm,
  );
  const [error, setError] = useState('');
  const [conflicted, setConflicted] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedbackState>({
    fields: {},
    attempt: 0,
  });
  const [checklistError, setChecklistError] = useState('');
  const [checklist, setChecklist] = useState('');
  // 여행 계획과 현장 기록을 작업별 영역으로 나눈다.
  const [activeSection, setActiveSection] = useState(
    section === 'share'
      ? 'share'
      : section === 'map'
        ? 'map'
        : section === 'expenses'
          ? 'expenses'
          : 'itinerary',
  );
  const [selectedDay, setSelectedDay] = useState('');
  const [courseDay, setCourseDay] = useState('');
  const [showTripMore, setShowTripMore] = useState(false);
  const pending = useRef<null | (() => Promise<unknown>)>(null);
  const pendingRebase = useRef<
    null | ((version: number) => () => Promise<unknown>)
  >(null);
  const pendingUsesForm = useRef(false);
  const running = useRef(false);
  const conflict = useRef(false);
  const trips = useQuery({
    queryKey: foundationQueryKey(userId, 'trips'),
    enabled: Boolean(userId && !id && !creating),
    queryFn: ({ signal }) => {
      // 실제 서버 목록만 사용한다.
      return serverOptions(userId).then((options) => {
        // 마지막 화면 구독이 끝나면 목록 조회도 중단한다.
        return listServerTrips(options, signal);
      });
    },
    retry: false,
  });
  const workspace = useQuery({
    queryKey: foundationQueryKey(userId, 'workspace', id),
    enabled: Boolean(userId && id),
    queryFn: ({ signal }) => {
      // URL 입력을 서버 멤버십 검증에 전달한다.
      return serverOptions(userId).then((options) => {
        // 확장 스냅샷을 검증해서 읽는다.
        return getWorkspace(options, id!, signal);
      });
    },
    retry: false,
  });
  const snapshot = workspace.data;
  const writable = Boolean(
    snapshot &&
    snapshot.myRole !== 'viewer' &&
    snapshot.trip.status !== 'ARCHIVED',
  );
  const owner = snapshot?.myRole === 'owner';
  // 권한·화면 해제·개발 모드 재구독을 고려해 후보를 일정 확인 폼으로 인계한다.
  useSharedSchedule(snapshot, writable, importing, setForm, setError);
  // 성공한 변경 이후 현재 계정의 서버 자료를 다시 읽는다.
  const { refresh, execute, clearPending, finishOperation, reload } =
    useWorkspaceSaveSession({
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
    });
  // 현재 버전에 명령 하나를 저장한다.
  const {
    command,
    queueVersioned,
    cancelConfirmation,
    confirmCommand,
    removeRegisteredImage,
  } = useWorkspaceCommands({
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
  });
  // 저장된 영수증의 실제 날짜로 이동하여 생성된 장소 기록을 보여준다.
  const { save, invalidForm, change } = useWorkspaceFormActions({
    setSelectedDay,
    setActiveSection,
    running,
    scanning,
    confirming,
    pending,
    execute,
    form,
    busy,
    snapshot,
    command,
    userId,
    setError,
    setFeedback,
    clearPending,
    setForm,
    finishOperation,
    router,
    importing,
  });
  // 등록한 비공개 원본의 인식 상태를 확인 화면에 연결한다.
  const { receipt, captureReceipt, photo } = useWorkspaceMediaActions({
    user,
    snapshot,
    setForm,
    scanning,
    setScanning,
    userId,
    setShowReceiptCapture,
    running,
    pending,
    setBusy,
    setError,
    finishOperation,
    command,
  });
  // 준비물 완료 명령을 동일 요청 키로 실행한다.
  const { check, addCheck } = useWorkspaceChecklistActions({
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
  });
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

  // 명령 본문과 초안 생성은 화면 이벤트 바인딩과 분리한다.
  const actions = useWorkspaceScreenActions({
    snapshot,
    command,
    edit,
    removeRegisteredImage,
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
    form,
    setForm,
    busy,
    scanning,
    confirmation,
    showReceiptCapture,
    setShowReceiptCapture,
    hasPending,
    error,
    feedback,
    checklistError,
    checklist,
    activeSection,
    setActiveSection,
    selectedDay,
    setSelectedDay,
    courseDay,
    setCourseDay,
    showTripMore,
    setShowTripMore,
    trips,
    workspace,
    snapshot,
    writable,
    owner,
    reload,
    command,
    cancelConfirmation,
    confirmCommand,
    removeRegisteredImage,
    save,
    invalidForm,
    change,
    receipt,
    captureReceipt,
    photo,
    check,
    addCheck,
    edit,
    openDraft,
    changeChecklist,
    retrySave,
    retryReceipt,
    conflicted,
    reloadLabel: conflicted ? '최신 내용 불러오기' : '여행 다시 불러오기',
    invite,
    closeCreation,
    creating,
    importing,
  };
}
