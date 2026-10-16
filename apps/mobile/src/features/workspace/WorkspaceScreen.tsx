import ModalBackground from '../accessibility/ModalBackground';
import Text from '@/components/AppText';
import { travelDateRange } from './travelDateRange';
import DesignButton from '@/components/DesignButton';
import {
  TripCostSummary,
  TripExpenseHeading,
  TripChecklistProgress,
  TripMemberHeading,
  TripDetailEmpty,
} from './TripDetailParts';
import { tripDetailStyles as detail } from './tripDetailStyles';
import { colors } from '@/constants/theme';
import TripAccessFeedback from './TripAccessFeedback';
import { authReturn } from '../auth/authReturn';
import ReceiptDetails from './ReceiptDetails';
import WorkspaceConfirmDialog from './WorkspaceConfirmDialog';
import {
  workspaceConfirmation,
  canConfirmWorkspaceAction,
  type WorkspaceConfirmation,
} from './workspaceConfirmation';
import {
  completeFormExit,
  requestScheduleExit,
  useScheduleExitGuard,
} from './scheduleExitGuard';
import {
  receiptForm,
  receiptDateValues,
  receiptConfirmationValues,
} from './receiptFlow';
import ReceiptCapture from './ReceiptCapture';
import HaruState from '@/components/HaruState';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import {
  createFoundationTrip,
  listServerTrips,
  getWorkspace,
  sendWorkspaceCommand,
  foundationQueryKey,
  FoundationClientError,
  addFoundationChecklist,
  setFoundationChecklist,
} from '@wherego/api-client';
import {
  workspaceTripSchema,
  checklistAddSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { useTripStore } from '@/stores/useTripStore';
import {
  serverOptions,
  selectImage,
  uploadImage,
  scanServerReceipt,
  shareInvite,
  removeImage,
} from './service';
import { Action, Field, ServerPhoto, styles } from './ui';
import { scheduleForm, formCommand, newTripForm, type PlanForm } from './forms';
import PlanEditor from './PlanEditor';
import { tripPresentation } from './tripLifecycle';
import { useTripDateRefresh } from './useTripDateRefresh';
import ScheduleCoursePicker from './ScheduleCoursePicker';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import TripIcon from '@/components/icons/TripIcon';
import ScreenHeader from '@/components/ScreenHeader';
import { TripSectionNavigation, TripMoreMenu } from './TripSectionNavigation';
import TripTimeline, { TripDayStrip } from './TripTimeline';
import { tripHubStyles as hub } from './tripHubStyles';
import HomeScreen from './HomeScreen';
import TripMap from './TripMap';
import { countryChangeValues } from './tripMetadata';
import { cityTimezones } from './DestinationPicker';
import { tripCreationInput } from './tripCreation';
import { useSharedSchedule } from './useSharedSchedule';
import { memberRoleLabel } from './presentation';
import { isMembershipRequired } from '@/services/guestWorkspaceClient';
import {
  canReviseWorkspaceRequest,
  isWorkspaceVersionConflict,
  workspaceErrorCode,
} from './saveRecovery';
import {
  formFailureFields,
  formInputFields,
  revisedFormFeedback,
  type FieldErrors,
  type FormFeedbackState,
} from './formFeedback';

// 실패한 인식 초안에 공개 상태에 따른 복구 안내만 추가한다.
function receiptScanFailure(
  snapshot: WorkspaceSnapshot,
  mediaId: string,
  failure: unknown,
): PlanForm {
  // 공급자 원문·보안 설정을 노출하지 않고 보관된 사진의 재시도를 안내한다.
  return {
    ...receiptForm(snapshot, mediaId, undefined, 'error'),
    values: {
      ...receiptForm(snapshot, mediaId, undefined, 'error').values,
      receiptError:
        failure instanceof FoundationClientError && failure.status === 429
          ? '스캔 횟수가 많아요. 잠시 후 다시 시도해 주세요. 하루 한도에 도달했다면 내일 다시 이용할 수 있어요. 원본 사진은 보관되어 있어요.'
          : '사진을 처리하지 못했어요. 잠시 후 다시 스캔하거나 글자가 선명한 사진을 선택해 주세요. 원본 사진은 보관되어 있어요.',
    },
  };
}

// API 실패를 입력 보존·재인증·충돌 안내로 바꾼다.
export function workspaceError(error: unknown): string {
  // 내부 SQL과 인증 토큰은 표시하지 않는다.
  return isMembershipRequired(error)
    ? '이 기능은 회원가입 후 사용할 수 있어요. 기기의 여행 기록은 그대로 보관돼요.'
    : error instanceof FoundationClientError
      ? isWorkspaceVersionConflict(error)
        ? '다른 동행이 내용을 변경했습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요. 작성한 내용은 유지됩니다.'
        : error.status === 409
          ? workspaceErrorCode(error) === 'TRIP_ARCHIVED'
            ? '보관된 여행은 수정할 수 없어요. 내 여행 목록으로 돌아가 주세요.'
            : '저장 결과를 다시 확인해야 해요. 입력한 내용을 유지하고 다시 저장해 주세요.'
          : error.status === 401
            ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
            : error.status === 403
              ? '이 여행을 변경할 권한이 없습니다.'
              : error.status === 410
                ? '초대가 만료되었거나 취소되었습니다.'
                : error.status === 503
                  ? '잠시 연결할 수 없어요. 조금 뒤에 다시 시도해 주세요.'
                  : error.status === 422
                    ? '날짜와 입력한 내용을 확인해 주세요.'
                    : '저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 저장해 주세요.'
      : error instanceof TypeError
        ? '연결이 끊겼어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.'
        : error instanceof Error
          ? error.name === 'ZodError'
            ? '날짜, 필수 항목, 금액 형식을 확인해 주세요.'
            : /[가-힣]/.test(error.message)
              ? error.message
              : '진행하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : '연결을 확인하고 재시도해 주세요.';
}
// 실제 계정의 여행 목록과 일정·비용·동행·사진 허브를 표시한다.
export default function WorkspaceScreen({
  creating = false,
}: {
  creating?: boolean;
}) {
  // 계정·여행 경로가 바뀌면 비공개 폼·재시도 상태를 새 화면으로 교체한다.
  const userId = useTripStore((state) => {
    // 게스트와 로그인 계정의 작성 상태를 분리한다.
    return state.currentUser?.id || 'public';
  });
  const { id, importPlace, destination } = useLocalSearchParams<{
    id?: string;
    importPlace?: string;
    destination?: string;
  }>();
  const [fontsLoaded, fontError] = useFonts({
    TripPrintRegular: require('../../../assets/fonts/pretendard-regular.otf'),
    TripPrintBold: require('../../../assets/fonts/pretendard-bold.otf'),
  });
  // React key로 이전 계정의 입력·요청 클로저를 남기지 않는다.
  return !fontsLoaded && !fontError ? (
    <HaruState kind="loading" title="여행을 불러오는 중입니다." compact />
  ) : (
    <WorkspaceContent
      key={`${userId}:${creating ? `new:${destination || ''}` : id || 'list'}:${importPlace || ''}`}
      creating={creating}
      importing={importPlace === '1'}
    />
  );
}
// 한 계정·한 여행의 서버 조회와 작성 명령을 연결한다.
function WorkspaceContent({
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
  const { id, section, destination } = useLocalSearchParams<{
    id?: string;
    section?: string;
    destination?: string;
  }>();
  const router = useRouter();
  const cache = useQueryClient();
  const userId = user?.id || '';
  const [form, setForm] = useState<PlanForm | null>(
    creating ? () => newTripForm(destination) : null,
  );
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmation, setConfirmation] =
    useState<WorkspaceConfirmation | null>(null);
  const confirming = useRef<null | {
    details: WorkspaceConfirmation;
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
  const [feedback, setFeedback] = useState<FormFeedbackState>({
    fields: {},
    attempt: 0,
  });
  const [checklistError, setChecklistError] = useState('');
  const [checklist, setChecklist] = useState('');
  // 여행 계획과 현장 기록을 작업별 영역으로 나눈다.
  const [activeSection, setActiveSection] = useState(
    section === 'share' ? 'share' : section === 'map' ? 'map' : 'itinerary',
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
    queryFn: () => {
      // 실제 서버 목록만 사용한다.
      return serverOptions(userId).then(listServerTrips);
    },
    retry: false,
  });
  const workspace = useQuery({
    queryKey: foundationQueryKey(userId, 'workspace', id),
    enabled: Boolean(userId && id),
    queryFn: () => {
      // URL 입력을 서버 멤버십 검증에 전달한다.
      return serverOptions(userId).then((options) => {
        // 확장 스냅샷을 검증해서 읽는다.
        return getWorkspace(options, id!);
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
  function refresh(): Promise<unknown> {
    // 목록·상세·공개 피드의 낡은 결과를 무효화한다.
    return cache.invalidateQueries(
      { queryKey: ['wherego', userId] },
      { throwOnError: true },
    );
  }
  // 확인된 저장 성공 또는 입력 오류에서 대기 요청만 해제한다.
  function clearPending(): void {
    // 화면에 작성 중인 폼과 업로드된 원본은 그대로 둔다.
    return void ((pending.current = null),
    (pendingRebase.current = null),
    (pendingUsesForm.current = false),
    (conflict.current = false),
    setHasPending(false));
  }
  // 충돌 자료를 다시 읽되 작성한 폼을 보존한다.
  function reload(): void {
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
  }
  // 최신 조회한 버전으로 사진·준비물 같은 폼 없는 명령도 다시 저장할 수 있게 준비한다.
  function recoverLatestConflict(
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
          setError(
            '최신 내용을 불러왔어요. 다시 저장하기를 눌러 작성한 내용을 반영해 주세요.',
          ))
        : void (clearPending(), setError(''));
  }
  // 한 번 시작한 작업이 끝난 뒤에만 다음 저장·사진 선택을 허용한다.
  function finishOperation(): void {
    // React 렌더링 이전의 연속 클릭도 같은 잠금으로 차단한다.
    return void ((running.current = false), setBusy(false));
  }
  // 확인된 성공 이후 화면과 조회 자료를 갱신한다.
  function saveSucceeded(): Promise<unknown> | undefined {
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
  }
  // 거부된 입력과 응답을 잃은 저장을 다른 복구 상태로 안내한다.
  function saveFailed(failure: unknown): void {
    // 계정이 바뀐 화면에는 이전 요청의 오류를 표시하지 않는다.
    return useTripStore.getState().currentUser?.id !== userId
      ? undefined
      : void (canReviseWorkspaceRequest(failure) ? clearPending() : undefined,
        (conflict.current = isWorkspaceVersionConflict(failure)),
        setError(workspaceError(failure)));
  }
  // 저장 중 또는 응답을 잃은 요청은 같은 클로저로 재시도한다.
  function execute(task: () => Promise<unknown>): void {
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
  }
  // 현재 버전에 명령 하나를 저장한다.
  function command(
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
  }
  // 일반 저장과 삭제 확인을 명령 종류에 따라 나눈다.
  function prepareCommand(
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
      ? void ((confirming.current = { details, after }),
        setConfirmation(details))
      : queueCommand(value, after, fromForm);
  }
  // 취소는 선택한 확인 정보만 지우며 저장 요청을 만들지 않는다.
  function cancelConfirmation(): void {
    // 닫기와 Android 뒤로도 같은 취소 경로를 사용한다.
    return void ((confirming.current = null), setConfirmation(null));
  }
  // 확인 당시와 같은 계정·버전·대상일 때만 삭제를 진행한다.
  function confirmCommand(): void {
    // 중복 확인 탭은 참조를 먼저 비워 차단한다.
    return applyConfirmedCommand(
      confirming.current,
      cache.getQueryData<WorkspaceSnapshot>(
        foundationQueryKey(userId, 'workspace', id),
      ),
    );
  }
  // 사진 등록 삭제 성공과 원본 파일 정리 실패를 구분해 재시도한다.
  function removeRegisteredImage(path?: string): Promise<void> {
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
            new Error(
              '사진 등록은 삭제했지만 원본 파일을 정리하지 못했어요. 다시 저장하기를 눌러 마무리해 주세요.',
            ),
          );
        });
    });
  }
  // 최신 원본과 확인한 명령을 대조한 뒤 한 번 실행한다.
  function applyConfirmedCommand(
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
          ? queueCommand(action.details.command, action.after)
          : setError(
              '여행 내용이 바뀌었어요. 최신 내용을 불러온 뒤 대상을 다시 확인해 주세요.',
            ));
  }
  // 사용자 확인을 마친 명령을 기존 멱등·버전 저장 경로로 전달한다.
  function queueCommand(
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
  }
  // 사용자 확인을 거친 버전 변경에 사용할 업무 요청 생성기만 보관한다.
  function queueVersioned(
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
  }
  // 저장된 영수증의 실제 날짜로 이동하여 생성된 장소 기록을 보여준다.
  function receiptRegistered(dayId: string): Promise<void> {
    // 서버에서 성공한 등록에만 날짜와 일정 탭을 변경한다.
    return Promise.resolve(setSelectedDay(dayId)).then(() => {
      // 영수증에서 생성된 여행 기록을 바로 확인한다.
      return setActiveSection('itinerary');
    });
  }
  // 새 여행 또는 기존 여행 폼을 확정한다.
  function save(): void {
    // 렌더링 전 연타와 사진 인식 중 저장도 기존 동기 잠금으로 차단한다.
    if (running.current || scanning || confirming.current) return;
    // 실패한 모달에서도 동일 본문·요청 키의 저장을 재개한다.
    if (pending.current) {
      execute(pending.current);
      return;
    }
    // 유효하지 않은 폼은 네트워크 요청 전에 안내한다.
    try {
      // 기존 여행은 공통 명령 계약으로 저장한다.
      if (!form || busy || pending.current) return;
      if (Object.keys(formInputFields(form.kind, form.values, snapshot)).length)
        return invalidForm(formInputFields(form.kind, form.values, snapshot));
      if (form.kind !== 'trip') {
        // 화면 폼이 선택한 일정·날짜를 검증한다.
        if (snapshot)
          command(
            formCommand(form, snapshot),
            form.kind === 'receipt'
              ? receiptRegistered.bind(null, form.values.dayId || '')
              : undefined,
            true,
          );
        return;
      }
      // 선택 여행지와 기간, 두 번째 단계의 항공편만 저장 계약으로 검증한다.
      const input = tripCreationInput(form.values);
      const key = form.id;
      execute(() => {
        // 여행과 DAY와 소유자 생성은 서버에서 원자적으로 수행한다.
        return serverOptions(userId)
          .then((options) => {
            // 실패 재시도는 동일 생성 UUID를 유지한다.
            return createFoundationTrip(options, input, key);
          })
          .then((result) => {
            // 확인된 서버 여행 ID로 이동한다.
            return useTripStore.getState().currentUser?.id === userId
              ? createdTrip(
                  z.object({ trip: workspaceTripSchema }).parse(result.data)
                    .trip.id,
                )
              : undefined;
          });
      });
    } catch (failure) {
      // 입력 오류에서는 작성 내용을 버리지 않는다.
      return void (invalidForm(formFailureFields(failure, form?.kind || '')),
      setError(workspaceError(failure)));
    }
  }
  // 필드 안내를 갱신하고 새 검증 시도에서 첫 오류로 이동한다.
  function invalidForm(fields: FieldErrors): void {
    // 오류를 고칠 때까지 입력 내용과 폼 식별자를 보존한다.
    return void (setFeedback((previous) => {
      /* 명시 제출에서만 이동 순번을 올린다. */ return {
        fields,
        attempt: previous.attempt + 1,
      };
    }),
    setError('입력한 항목을 확인해 주세요. 작성한 내용은 그대로 있어요.'));
  }
  // 생성 성공 후에만 작성 수명을 해제하고 서버 여행으로 이동한다.
  function createdTrip(tripId: string): void {
    // 일반 이탈 보호가 성공한 여행 생성의 화면 이동을 막지 않게 한다.
    return void (clearPending(),
    setForm(null),
    finishOperation(),
    completeFormExit(() => {
      // 확인된 서버 ID와 원래 장소 가져오기 목적을 전달한다.
      return router.replace(
        `/trips/${tripId}${importing ? '?importPlace=1' : ''}`,
      );
    }));
  }
  // 폼 필드 하나를 바꾸되 연결 일정의 DAY를 일치시킨다.
  function change(key: string, value: string): void {
    // 불확실한 저장 응답이 있는 동안 요청 본문을 고정한다.
    if (
      running.current ||
      busy ||
      scanning ||
      pending.current ||
      confirming.current
    )
      return;
    setFeedback((previous) => {
      /* 수정한 입력과 연관된 안내만 지운다. */ return revisedFormFeedback(
        previous,
        key,
      );
    });
    setError('');
    setForm((previous) => {
      // 기존 폼의 식별자와 다른 필드는 보존한다.
      return previous
        ? {
            ...previous,
            values: {
              ...previous.values,
              [key]: value,
              ...(previous.kind === 'receipt'
                ? receiptConfirmationValues(key, value)
                : {}),
              ...(key === 'country'
                ? countryChangeValues(
                    previous.kind,
                    previous.values.country,
                    value,
                  )
                : {}),
              ...(previous.kind === 'trip' &&
              key === 'city' &&
              cityTimezones[value]
                ? { timezone: cityTimezones[value] }
                : {}),
              ...(key === 'transactionDate' && previous.kind === 'receipt'
                ? receiptDateValues(snapshot, value)
                : {}),
              ...(key === 'dayId' && previous.kind === 'receipt'
                ? { scheduleId: '' }
                : key === 'scheduleId' && value
                  ? {
                      dayId:
                        snapshot?.itinerary.find((item) => {
                          // 선택 일정이 속한 날짜를 사용한다.
                          return item.id === value;
                        })?.dayId ||
                        previous.values.dayId ||
                        '',
                    }
                  : {}),
            },
          }
        : null;
    });
  }
  // 등록한 비공개 원본의 인식 상태를 확인 화면에 연결한다.
  function receipt(mediaId: string): Promise<unknown> {
    // 권한·일정 스냅샷이 있는 현재 화면만 인식 요청을 시작한다.
    return user?.authProvider === 'guest' && snapshot
      ? Promise.resolve(
          setForm(receiptForm(snapshot, mediaId, undefined, 'manual')),
        )
      : scanning || !snapshot
        ? Promise.resolve()
        : beginReceiptScan(mediaId);
  }
  // 인식 중 화면과 실제 서버 요청 하나를 연결한다.
  function beginReceiptScan(mediaId: string): Promise<unknown> {
    // 상태 갱신과 초안 요청을 순서대로 처리한다.
    return Promise.resolve(setScanning(true))
      .then(() => {
        // 이전 인식 결과를 저장 가능한 상태로 표시하지 않는다.
        return setForm(receiptForm(snapshot!, mediaId, undefined, 'loading'));
      })
      .then(() => {
        // 실제 원본 미디어 ID만 서버에 전달한다.
        return serverOptions(userId).then((options) => {
          // 외부 공유 URL로 영수증 원본을 노출하지 않는다.
          return scanServerReceipt(options, snapshot!.trip.id, mediaId);
        });
      })
      .then((draft) => {
        // 계정 전환 이후에는 이전 계정의 인식 결과를 표시하지 않는다.
        return useTripStore.getState().currentUser?.id === userId
          ? setForm(receiptForm(snapshot!, mediaId, draft))
          : undefined;
      })
      .catch((failure: unknown) => {
        // 실패를 빈 수동 입력 성공으로 대체하지 않고 재스캔을 안내한다.
        return useTripStore.getState().currentUser?.id === userId
          ? setForm(receiptScanFailure(snapshot!, mediaId, failure))
          : undefined;
      })
      .finally(() => {
        // 완료 또는 실패 시에만 다음 사용자의 선택을 허용한다.
        return setScanning(false);
      });
  }
  // 사용자 선택 사진을 비공개 저장하고 용도 메타데이터를 등록한다.
  function captureReceipt(camera: boolean): Promise<void> {
    // 안내 화면 닫기와 실제 선택을 순서대로 진행한다.
    return Promise.resolve(setShowReceiptCapture(false)).then(() => {
      // 미리보기용 인식 결과를 만드는 대신 실제 이미지 선택을 시작한다.
      return photo('receipt', camera);
    });
  }

  // 사용자 선택 사진을 비공개 저장하고 용도 메타데이터를 등록한다.
  function photo(
    purpose: 'photo' | 'receipt',
    camera = false,
    scheduleId?: string,
  ): void {
    // 렌더링 이전 연속 선택을 막고 시작한 계정의 여행에만 사진을 저장한다.
    return !snapshot || running.current || pending.current
      ? undefined
      : void ((running.current = true),
        setBusy(true),
        setError(''),
        selectImage(camera)
          .then((asset) => {
            // 취소한 사진은 기록하지 않으며 선택 당시 계정을 업로드까지 전달한다.
            return asset ? uploadImage(userId, snapshot.trip.id, asset) : null;
          })
          .then((media) => {
            // 계정 전환 이전 원본을 새 계정의 메타데이터로 등록하지 않는다.
            return (
              finishOperation(),
              media && useTripStore.getState().currentUser?.id === userId
                ? command(
                    {
                      operation: 'media.register',
                      input: {
                        ...media,
                        purpose,
                        ...(scheduleId ? { scheduleId } : {}),
                      },
                    },
                    purpose === 'receipt'
                      ? () => {
                          // 명령 완료 이후 수동·OCR 확인 폼을 열기 위해 예약한다.
                          return Promise.resolve(
                            setTimeout(() => {
                              // execute의 성공 폼 초기화 이후 영수증 폼을 시작한다.
                              return useTripStore.getState().currentUser?.id ===
                                userId
                                ? void receipt(media.id)
                                : undefined;
                            }, 0),
                          );
                        }
                      : undefined,
                  )
                : undefined
            );
          })
          .catch((failure: unknown) => {
            // 업로드 실패를 성공으로 안내하지 않으며 이전 계정의 오류는 표시하지 않는다.
            return void (finishOperation(),
            useTripStore.getState().currentUser?.id === userId
              ? setError(workspaceError(failure))
              : undefined);
          }));
  }
  // 준비물 완료 명령을 동일 요청 키로 실행한다.
  function check(item: { id: string; isCompleted: boolean }): void {
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
  }
  // 새 준비물을 실제 서버에 저장한다.
  function addCheck(): void {
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
  }
  // 준비물 제목을 캡처한 뒤 버전별 재시도 요청을 만든다.
  function queueChecklist(title: string): void {
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
  }
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
  // 새 여행 작성 폼을 독립된 페이지로 표시한다.
  if (!id && !creating)
    return (
      <HomeScreen
        userId={userId}
        trips={trips.data}
        loading={trips.isLoading}
        error={trips.error ? workspaceError(trips.error) : ''}
        onReload={reload}
      />
    );
  // 홈에서 고른 목적지로 인증된 계정의 여행 생성을 시작한다.
  if (creating && userId)
    return (
      <PlanEditor
        userId={userId}
        form={form}
        busy={busy}
        locked={busy || scanning || hasPending || Boolean(confirmation)}
        feedback={feedback}
        onInvalid={invalidForm}
        error={error}
        onChange={change}
        onSave={save}
        onReload={reload}
        onClose={closeCreation}
        onRescan={() => {
          // 여행 생성 화면에는 재스캔할 원본이 없다.
          return undefined;
        }}
        onReceipt={() => {
          // 여행 생성 페이지에서는 영수증을 등록하지 않는다.
          return;
        }}
      />
    );
  // 저장된 실제 자료만 화면에 표시한다.
  return (
    <SafeAreaView style={hub.screen}>
      <ModalBackground>
        {id && (
          <ScreenHeader
            title="여행 상세"
            backLabel="내 여행 목록"
            onBack={() => {
              /* 작성 중인 내용과 대기 요청을 확인한 뒤 목록으로 돌아간다. */ return requestScheduleExit(
                () => {
                  /* 기존 목록 경로를 연다. */ return router.replace('/plans');
                },
              );
            }}
            right={
              snapshot && !workspace.isError ? (
                <DesignButton
                  label=""
                  accessibilityLabel="여행 더보기"
                  expanded={showTripMore}
                  variant="quiet"
                  size="icon"
                  onPress={() => {
                    // 부가 기능과 소유자 설정을 같은 메뉴에서 연다.
                    return setShowTripMore(true);
                  }}
                  icon={(color) => {
                    // 상단 메뉴는 항상 같은 점 세 개 아이콘으로 표시한다.
                    return (
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={24}
                        color={color}
                      />
                    );
                  }}
                />
              ) : undefined
            }
          />
        )}
        <ScrollView
          testID="trip-content"
          contentContainerStyle={hub.content}
          keyboardShouldPersistTaps="handled"
        >
          {user?.authProvider === 'guest' && (
            <View style={styles.card}>
              <Text>
                게스트 여행은 이 기기에만 저장돼요. 다른 기기에서는 볼 수 없으며
                앱이나 저장 데이터를 삭제하면 복구할 수 없어요.
              </Text>
              <Action
                label="로그인 / 회원가입"
                onPress={() => {
                  // 기기 여행을 자동 업로드하지 않고 회원 인증을 선택하게 한다.
                  return router.push('/login');
                }}
              />
            </View>
          )}
          {!userId ? (
            <View style={styles.card}>
              <Text style={styles.title}>로그인하고 여행을 시작하세요</Text>
              <Text>
                이메일로 로그인하면 여행을 저장하고 친구와 함께 계획할 수
                있어요.
              </Text>
              <Action
                label="로그인 / 회원가입"
                onPress={() => {
                  // 실제 인증 화면으로 이동한다.
                  return router.push(
                    creating
                      ? {
                          pathname: '/login',
                          params: {
                            next: 'new-trip',
                            destination: destination || '',
                          },
                        }
                      : {
                          pathname: '/login',
                          params: authReturn('trip', undefined, id),
                        },
                  );
                }}
              />
            </View>
          ) : (
            <>
              {(trips.isLoading || workspace.isLoading) && (
                <HaruState
                  kind="loading"
                  title="여행을 불러오는 중입니다."
                  compact
                />
              )}
              {(trips.error || workspace.error) && (
                <TripAccessFeedback
                  error={trips.error || workspace.error}
                  target={authReturn('trip', undefined, id)}
                  onRetry={reload}
                  busy={trips.isFetching || workspace.isFetching}
                />
              )}
              {snapshot && !workspace.isError && (
                <>
                  {importing && !writable && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      읽기 전용 또는 보관된 여행에는 장소를 추가할 수 없습니다.
                      편집 가능한 여행을 선택해 주세요.
                    </Text>
                  )}
                  <View style={hub.tripHeader}>
                    <View style={hub.titleRow}>
                      <Text style={hub.tripTitle}>{snapshot.trip.title}</Text>
                    </View>
                    <Text style={hub.status}>
                      {tripPresentation(snapshot.trip).label} ·{' '}
                      {travelDateRange(
                        snapshot.trip.startDate,
                        snapshot.trip.endDate,
                      )}
                    </Text>
                    {tripPresentation(snapshot.trip).phase === 'PAST' && (
                      <Text style={hub.meta}>
                        여행 기간이 지났어요. 일정을 확인하고 여행 설정에서 완료
                        여부를 정해 주세요.
                      </Text>
                    )}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <TripIcon name="user-outline" size={16} />
                      <Text style={hub.meta}>
                        {snapshot.trip.city || snapshot.trip.country} · 함께하는
                        멤버 {snapshot.members.length}명 ·{' '}
                        {memberRoleLabel(snapshot.myRole)}
                      </Text>
                    </View>
                    {snapshot.trip.status === 'COMPLETED' && (
                      <Action
                        label="발자국 다이어리 보기"
                        onPress={() => {
                          // 종료된 여행의 일정·사진·비용을 날짜별로 읽는다.
                          return router.push(`/diary/${snapshot.trip.id}`);
                        }}
                      />
                    )}
                  </View>
                  <TripSectionNavigation
                    selected={activeSection}
                    onSelect={setActiveSection}
                  />
                  {busy && !form && (
                    <View
                      style={[detail.card, detail.heading]}
                      accessibilityLiveRegion="polite"
                    >
                      <ActivityIndicator color={colors.text} size="small" />
                      <Text style={detail.meta}>여행에 반영하고 있어요…</Text>
                    </View>
                  )}
                  {activeSection === 'map' && !form && (
                    <>
                      <TripDayStrip
                        days={snapshot.days}
                        selected={
                          snapshot.days.some((day) => {
                            // 기간 변경으로 사라진 선택은 첫 여행 날짜로 복구한다.
                            return day.id === selectedDay;
                          })
                            ? selectedDay
                            : snapshot.days[0]?.id || ''
                        }
                        onSelect={setSelectedDay}
                      />
                      <TripMap
                        key={selectedDay}
                        snapshot={snapshot}
                        dayId={
                          snapshot.days.some((day) => {
                            // 해당 날짜의 저장된 일정만 지도에서 읽는다.
                            return day.id === selectedDay;
                          })
                            ? selectedDay
                            : snapshot.days[0]?.id || ''
                        }
                        disabled={!writable || busy || scanning || hasPending}
                        onEdit={(item) => {
                          // 지도 위치 편집에서도 기존 일정의 저장·충돌 규칙을 유지한다.
                          return edit(scheduleForm(snapshot, item));
                        }}
                      />
                    </>
                  )}
                  {activeSection === 'itinerary' && (
                    <>
                      <TripDayStrip
                        allowAll
                        days={snapshot.days}
                        selected={
                          selectedDay === 'all'
                            ? 'all'
                            : snapshot.days.find((day) => {
                                // 여행 기간 변경으로 사라진 선택 날짜는 첫 날짜로 복구한다.
                                return day.id === selectedDay;
                              })?.id ||
                              snapshot.days[0]?.id ||
                              ''
                        }
                        onSelect={setSelectedDay}
                      />
                      {snapshot.days
                        .filter((day) => {
                          // 기간 변경으로 선택 날짜가 사라지면 첫 날짜를 표시한다.
                          return (
                            selectedDay === 'all' ||
                            day.id ===
                              (snapshot.days.some((item) => {
                                // 선택 날짜가 최신 여행에 남아 있는지 확인한다.
                                return item.id === selectedDay;
                              })
                                ? selectedDay
                                : snapshot.days[0]?.id)
                          );
                        })
                        .map((day) => (
                          <TripTimeline
                            key={day.id}
                            snapshot={snapshot}
                            userId={userId}
                            day={day}
                            canCreate={writable}
                            onAdd={() => {
                              // 현재 날짜의 작성 화면에서 지도 검색과 링크 입력을 바로 펼친다.
                              return edit({
                                ...scheduleForm(snapshot, undefined, day.id),
                                values: {
                                  ...scheduleForm(snapshot, undefined, day.id)
                                    .values,
                                  placeSearchExpanded: 'true',
                                },
                              });
                            }}
                            onCourse={() => {
                              // 코스를 넣을 날짜를 선택 당시 값으로 고정한다.
                              return setCourseDay(day.id);
                            }}
                            disabled={
                              !writable || busy || scanning || hasPending
                            }
                            onReorder={(ids) => {
                              // 날짜의 모든 방문 순서를 하나의 버전 명령으로 저장한다.
                              return command({
                                operation: 'schedule.reorder',
                                input: { dayId: day.id, ids },
                              });
                            }}
                            onExpense={(item) => {
                              // 선택 장소에 실제 지출을 연결한다.
                              return edit({
                                kind: 'expense',
                                id: Crypto.randomUUID(),
                                values: {
                                  title: item.title,
                                  amount: '',
                                  currency: snapshot.trip.defaultCurrency,
                                  category: 'etc',
                                  isActual: 'true',
                                  scheduleId: item.id,
                                },
                              });
                            }}
                            onCapture={(item) => {
                              // 실제 카메라 사진을 선택한 장소에 연결한다.
                              return photo('photo', true, item.id);
                            }}
                            onPhoto={(item) => {
                              // 기존 앨범 사진을 선택한 장소에 연결한다.
                              return photo('photo', false, item.id);
                            }}
                            onEdit={(item) => {
                              // 기존 일정의 편집 입력을 구성한다.
                              return edit(scheduleForm(snapshot, item));
                            }}
                            onDelete={(item) => {
                              // 영수증 연결 보호가 적용된 삭제 명령을 실행한다.
                              return command({
                                operation: 'schedule.delete',
                                input: { id: item.id },
                              });
                            }}
                          />
                        ))}
                    </>
                  )}
                  {['expenses', 'photos'].includes(activeSection) && (
                    <View style={styles.row}>
                      {activeSection === 'expenses' && (
                        <Action
                          variant="primary"
                          label="비용 추가"
                          disabled={!writable || busy || scanning || hasPending}
                          onPress={() => {
                            // 실제 비용과 예상 비용은 명시적으로 구분한다.
                            edit({
                              kind: 'expense',
                              id: Crypto.randomUUID(),
                              values: {
                                title: '',
                                amount: '',
                                currency: snapshot.trip.defaultCurrency,
                                isActual: 'true',
                                category: 'etc',
                                scheduleId: '',
                              },
                            });
                          }}
                        />
                      )}
                      {activeSection === 'photos' && (
                        <Action
                          variant="primary"
                          label="사진 추가"
                          disabled={!writable || busy || scanning || hasPending}
                          onPress={() => {
                            // 사진은 멤버만 읽는 비공개 원본으로 업로드한다.
                            photo('photo');
                          }}
                        />
                      )}
                      <Action
                        label="영수증 촬영"
                        disabled={!writable || busy || scanning || hasPending}
                        onPress={() => {
                          // 촬영 안내를 확인한 뒤 실제 기기 카메라로 진행한다.
                          return setShowReceiptCapture(true);
                        }}
                      />
                      <Action
                        label="영수증 사진 선택"
                        disabled={!writable || busy || scanning || hasPending}
                        onPress={() => {
                          // 기존 촬영 영수증도 같은 확인 절차를 사용한다.
                          photo('receipt');
                        }}
                      />
                    </View>
                  )}
                  {activeSection === 'itinerary' && (
                    <Action
                      label="Google Maps 장소 가져오기"
                      variant="quiet"
                      onPress={() => {
                        // 장소의 공유 링크를 가져오는 실제 도구를 연다.
                        return router.push('/import-place');
                      }}
                    />
                  )}
                  {activeSection === 'expenses' && (
                    <View testID="trip-expenses-panel" style={detail.section}>
                      <Text style={detail.title}>비용</Text>
                      <TripCostSummary expenses={snapshot.expenses} />
                      {!snapshot.expenses.length && (
                        <TripDetailEmpty
                          title="아직 기록한 비용이 없어요"
                          description={
                            writable
                              ? '비용 추가에서 실제 지출이나 예상 비용을 남겨보세요.'
                              : '여행에서 남긴 비용을 여기서 함께 확인해요.'
                          }
                        />
                      )}
                      {snapshot.expenses.map((item) => (
                        <View key={item.id} style={detail.card}>
                          <TripExpenseHeading
                            item={item}
                            scheduleTitle={
                              snapshot.itinerary.find((schedule) => {
                                /* 비용에 연결한 실제 일정만 찾는다. */ return (
                                  schedule.id === item.scheduleId
                                );
                              })?.title
                            }
                          />
                          {item.source === 'manual' && (
                            <View style={styles.row}>
                              <Action
                                label="비용 수정"
                                disabled={
                                  !writable || busy || scanning || hasPending
                                }
                                onPress={() => {
                                  // 정수 통화는 편집 시 불필요한 소수점 00을 제거한다.
                                  edit({
                                    kind: 'expense',
                                    id: item.id,
                                    values: {
                                      title: item.title,
                                      amount:
                                        item.currency === 'USD'
                                          ? item.amount
                                          : item.amount.split('.')[0]!,
                                      currency: item.currency,
                                      isActual: String(item.isActual),
                                      category: item.category,
                                      scheduleId: item.scheduleId || '',
                                    },
                                  });
                                }}
                              />
                              <Action
                                variant="danger"
                                label="비용 삭제"
                                disabled={
                                  !writable || busy || scanning || hasPending
                                }
                                onPress={() => {
                                  // 영수증 비용은 영수증 기록 삭제로만 제거한다.
                                  command({
                                    operation: 'expense.delete',
                                    input: { id: item.id },
                                  });
                                }}
                              />
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  {activeSection === 'photos' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>사진 · 영수증</Text>
                      {snapshot.receipts
                        .filter((item) => {
                          // 원본을 보관하지 않은 기록도 다시 조회할 수 있다.
                          return item.keepPhoto === false;
                        })
                        .map((item) => (
                          <View key={item.id} style={styles.card}>
                            <Text style={styles.title}>
                              {item.merchant} · {item.date} · {item.amount}{' '}
                              {item.currency}
                            </Text>
                            <Text style={styles.subtitle}>
                              정보만 저장한 영수증
                            </Text>
                            <ReceiptDetails receipt={item} />
                            <Action
                              label="영수증 기록·지출 삭제"
                              disabled={
                                !writable || busy || scanning || hasPending
                              }
                              onPress={() => {
                                // 사진 보관 여부와 무관하게 기록과 지출을 함께 삭제한다.
                                return command({
                                  operation: 'receipt.delete',
                                  input: { id: item.id },
                                });
                              }}
                            />
                          </View>
                        ))}
                      {snapshot.media.map((media) => (
                        <View key={media.id} style={{ gap: 10 }}>
                          <ServerPhoto
                            userId={userId}
                            tripId={snapshot.trip.id}
                            mediaId={media.id}
                          />
                          <Text>
                            {media.purpose === 'receipt'
                              ? '비공개 영수증'
                              : '여행 사진'}
                          </Text>
                          {media.purpose === 'receipt' &&
                            !snapshot.receipts.some((item) => {
                              // 확정 기록이 없는 원본은 인식·수동 확인을 재개할 수 있다.
                              return item.mediaId === media.id;
                            }) && (
                              <Action
                                label="영수증 확인 / 인식 재시도"
                                disabled={
                                  !writable || busy || scanning || hasPending
                                }
                                onPress={() => {
                                  // 같은 원본에서 확인 폼을 다시 작성한다.
                                  void receipt(media.id).catch(
                                    (failure: unknown) => {
                                      // 취소·실패를 사용자에게 안내한다.
                                      setError(workspaceError(failure));
                                    },
                                  );
                                }}
                              />
                            )}
                          {snapshot.receipts
                            .filter((item) => {
                              // 원본과 확정 기록을 함께 표시한다.
                              return item.mediaId === media.id;
                            })
                            .map((item) => (
                              <View key={item.id}>
                                <Text>
                                  {item.merchant} · {item.date} · {item.amount}{' '}
                                  {item.currency}
                                </Text>
                                <ReceiptDetails receipt={item} />
                                <Action
                                  variant="danger"
                                  label="영수증 기록·지출 삭제"
                                  disabled={
                                    !writable || busy || scanning || hasPending
                                  }
                                  onPress={() => {
                                    // 기록과 실제 비용을 한 트랜잭션에서 제거한다.
                                    command({
                                      operation: 'receipt.delete',
                                      input: { id: item.id },
                                    });
                                  }}
                                />
                              </View>
                            ))}
                          <Action
                            variant="danger"
                            label="사진 등록 삭제"
                            disabled={
                              !writable || busy || scanning || hasPending
                            }
                            onPress={() => {
                              // 게시 사진과 영수증 참조는 서버가 삭제를 제한한다.
                              command(
                                {
                                  operation: 'media.delete',
                                  input: { id: media.id },
                                },
                                (result) => {
                                  // 참조 해제를 확인한 뒤 같은 경로의 실제 원본도 제거한다.
                                  return removeRegisteredImage(result.path);
                                },
                              );
                            }}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                  {activeSection === 'preparation' && (
                    <View testID="trip-checklist-panel" style={detail.section}>
                      <TripChecklistProgress items={snapshot.checklists} />
                      {!snapshot.checklists.length && (
                        <TripDetailEmpty
                          title="아직 준비물이 없어요"
                          description={
                            writable
                              ? '아래에 챙길 물건을 적어보세요. 준비한 항목은 체크할 수 있어요.'
                              : '동행자가 추가한 준비물을 여기서 함께 확인해요.'
                          }
                        />
                      )}
                      {snapshot.checklists.map((item) => (
                        <DesignButton
                          key={item.id}
                          label={item.title}
                          accessibilityLabel={`${item.isCompleted ? '✓ ' : '□ '}${item.title}`}
                          checked={item.isCompleted}
                          selected={item.isCompleted}
                          icon={(color) => {
                            /* 완료 전에도 체크 위치를 읽기 쉬운 선으로 표시한다. */ return (
                              <Ionicons
                                name="square-outline"
                                size={20}
                                color={color}
                              />
                            );
                          }}
                          disabled={!writable || busy || scanning || hasPending}
                          onPress={() => {
                            // 권한·버전 검증을 포함해 완료 상태를 저장한다.
                            check(item);
                          }}
                        />
                      ))}
                      {writable && (
                        <>
                          <Field
                            label="새 준비물"
                            disabled={busy || scanning || hasPending}
                            value={checklist}
                            onChange={(value) => {
                              /* 대기 중인 준비물 요청과 입력을 섞지 않는다. */ return running.current ||
                                pending.current
                                ? undefined
                                : void (setChecklist(value),
                                  setChecklistError(''));
                            }}
                          />
                          {checklistError ? (
                            <Text
                              accessibilityRole="alert"
                              style={styles.error}
                            >
                              {checklistError}
                            </Text>
                          ) : null}
                          <Action
                            label="준비물 추가"
                            variant="primary"
                            disabled={busy || scanning || hasPending}
                            onPress={addCheck}
                          />
                        </>
                      )}
                    </View>
                  )}
                  {activeSection === 'companions' && (
                    <View testID="trip-companions-panel" style={detail.section}>
                      <Text style={detail.title}>동행</Text>
                      <Text style={detail.meta}>
                        함께하는 {snapshot.members.length}명 · 여행을 만든
                        사람이 초대와 역할을 관리해요.
                      </Text>
                      {snapshot.members.map((member) => (
                        <View key={member.memberId} style={detail.card}>
                          <TripMemberHeading member={member} />
                          {owner && member.role !== 'owner' && (
                            <View style={styles.row}>
                              <Action
                                label={
                                  member.role === 'viewer'
                                    ? '편집자로 변경'
                                    : '보기 전용으로 변경'
                                }
                                disabled={busy || scanning || hasPending}
                                onPress={() => {
                                  // 소유자 역할은 변경할 수 없다.
                                  command({
                                    operation: 'member.role',
                                    input: {
                                      userId: member.userId,
                                      role:
                                        member.role === 'viewer'
                                          ? 'editor'
                                          : 'viewer',
                                    },
                                  });
                                }}
                              />
                              <Action
                                variant="danger"
                                label="동행 참여 해제"
                                disabled={busy || scanning || hasPending}
                                onPress={() => {
                                  // 수락한 이전 초대도 함께 취소한다.
                                  command({
                                    operation: 'member.remove',
                                    input: { userId: member.userId },
                                  });
                                }}
                              />
                            </View>
                          )}
                        </View>
                      ))}
                      {owner && (
                        <>
                          <View style={styles.row}>
                            <Action
                              label="편집 초대 공유"
                              variant="primary"
                              disabled={busy || scanning || hasPending}
                              onPress={() => {
                                // 공동 작성 가능한 초대를 발급한다.
                                invite('editor');
                              }}
                            />
                            <Action
                              label="보기 초대 공유"
                              disabled={busy || scanning || hasPending}
                              onPress={() => {
                                // 읽기 전용 역할을 서버에 기록한다.
                                invite('viewer');
                              }}
                            />
                          </View>
                          <Text style={detail.title}>초대 내역</Text>
                          {!snapshot.invites.length && (
                            <Text style={detail.meta}>
                              아직 보낸 초대가 없어요. 위에서 함께할 사람을
                              초대해 보세요.
                            </Text>
                          )}
                          {snapshot.invites.map((item) => (
                            <View key={item.id} style={detail.card}>
                              <Text style={detail.meta}>
                                {memberRoleLabel(item.role)} · 만료{' '}
                                {item.expiresAt.slice(0, 10)} ·{' '}
                                {item.revokedAt
                                  ? '취소됨'
                                  : item.usedAt
                                    ? '수락됨'
                                    : '대기 중'}
                              </Text>
                              {!item.revokedAt && (
                                <Action
                                  variant="danger"
                                  label="초대 취소"
                                  disabled={busy || scanning || hasPending}
                                  onPress={() => {
                                    // 링크를 즉시 더 이상 수락할 수 없게 한다.
                                    command({
                                      operation: 'invite.revoke',
                                      input: { id: item.id },
                                    });
                                  }}
                                />
                              )}
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                  {owner && activeSection === 'share' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>여행을 커뮤니티에 공유</Text>
                      <Action
                        label="커뮤니티"
                        variant="quiet"
                        onPress={() => {
                          // 공개된 여행을 확인할 수 있는 피드로 이동한다.
                          return router.push('/(tabs)/community');
                        }}
                      />
                      <Text>
                        여행을 종료한 뒤 공개할 일정·사진·금액을 확인해 주세요.
                      </Text>
                      <Action
                        label={
                          snapshot.postId
                            ? '게시 내용 다시 선택'
                            : '공개 내용 작성'
                        }
                        disabled={
                          snapshot.trip.status !== 'COMPLETED' ||
                          busy ||
                          hasPending
                        }
                        onPress={() => {
                          // 새 공개 폼은 모든 민감 항목을 선택 해제한다.
                          edit({
                            kind: 'publish',
                            id: Crypto.randomUUID(),
                            values: {
                              title: snapshot.trip.title,
                              body: '',
                              scheduleIds: '',
                              photoIds: '',
                              includeCosts: 'false',
                            },
                          });
                        }}
                      />
                      {snapshot.postId && (
                        <Action
                          variant="danger"
                          label="커뮤니티 게시 철회"
                          disabled={busy || scanning || hasPending}
                          onPress={() => {
                            // 철회 시 선택 사진의 공개 읽기 권한도 제거된다.
                            command({
                              operation: 'community.withdraw',
                              input: {},
                            });
                          }}
                        />
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}
          {error && !form && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          {hasPending && !busy && (
            <Action
              label="다시 저장하기"
              onPress={() => {
                // 저장 여부가 불확실한 요청을 중복 생성하지 않는다.
                if (pending.current) execute(pending.current);
              }}
            />
          )}
          {error && !form && (
            <Action
              label={
                error.includes('동행')
                  ? '최신 내용 불러오기'
                  : '여행 다시 불러오기'
              }
              disabled={busy}
              onPress={reload}
            />
          )}
          {busy && form && (
            <Text style={detail.meta} accessibilityLiveRegion="polite">
              여행에 반영하고 있어요…
            </Text>
          )}
        </ScrollView>
        {snapshot &&
          !workspace.isError &&
          activeSection === 'itinerary' &&
          writable &&
          !form && (
            <View style={hub.primaryBar} testID="trip-primary-action">
              <View style={hub.primaryButton}>
                <DesignButton
                  label="일정 추가"
                  variant="primary"
                  disabled={busy || scanning || hasPending}
                  icon={(color) => {
                    // 하단의 유일한 주요 행동에 추가 아이콘을 붙인다.
                    return <Ionicons name="add" size={22} color={color} />;
                  }}
                  onPress={() => {
                    // 전체 날짜에서는 기존 규칙대로 첫 날짜의 작성 화면을 연다.
                    return edit(scheduleForm(snapshot, undefined, selectedDay));
                  }}
                />
              </View>
            </View>
          )}
      </ModalBackground>
      <TripMoreMenu
        visible={showTripMore}
        owner={owner}
        selected={activeSection}
        disabled={busy || scanning || hasPending}
        onEditInfo={() => {
          // 메뉴를 닫고 소유자의 기존 정보·종료 상태 폼을 연다.
          return snapshot
            ? void (setShowTripMore(false),
              edit({
                kind: 'metadata',
                id: Crypto.randomUUID(),
                values: {
                  title: snapshot.trip.title,
                  country: snapshot.trip.country,
                  city: snapshot.trip.city,
                  status: snapshot.trip.status,
                },
              }))
            : undefined;
        }}
        onEditPeriod={() => {
          // 기간 변경은 기존 기록 유지와 확인 경로를 그대로 사용한다.
          return snapshot
            ? void (setShowTripMore(false),
              edit({
                kind: 'period',
                id: Crypto.randomUUID(),
                values: {
                  startDate: snapshot.trip.startDate,
                  endDate: snapshot.trip.endDate,
                },
              }))
            : undefined;
        }}
        onClose={() => {
          /* 메뉴를 닫아도 기존 영역을 유지한다. */ return setShowTripMore(
            false,
          );
        }}
        onSelect={(next) => {
          /* 영역을 선택한 뒤 보조 메뉴만 닫는다. */ return void (setActiveSection(
            next,
          ),
          setShowTripMore(false));
        }}
      />
      {snapshot && (
        <ScheduleCoursePicker
          visible={Boolean(courseDay)}
          country={snapshot.trip.country}
          city={snapshot.trip.city}
          onClose={() => {
            // 미리보기 취소는 일정이나 날짜를 바꾸지 않는다.
            return setCourseDay('');
          }}
          onSelect={(place) => {
            // 선택한 장소와 설명만 채우고 시간·위치는 사용자가 확인한다.
            return void (edit({
              ...scheduleForm(snapshot, undefined, courseDay),
              values: {
                ...scheduleForm(snapshot, undefined, courseDay).values,
                title: place.title,
                memo: place.description,
              },
            }),
            setCourseDay(''));
          }}
          onSearch={() => {
            // 코스가 없는 도시도 선택한 날짜의 장소 검색으로 이어간다.
            return void (edit({
              ...scheduleForm(snapshot, undefined, courseDay),
              values: {
                ...scheduleForm(snapshot, undefined, courseDay).values,
                placeSearchExpanded: 'true',
              },
            }),
            setCourseDay(''));
          }}
        />
      )}
      <ReceiptCapture
        visible={showReceiptCapture}
        busy={busy || scanning}
        onClose={() => {
          // 취소는 업로드나 일정 변경을 만들지 않는다.
          return setShowReceiptCapture(false);
        }}
        onCapture={() => {
          // 촬영 안내를 닫은 다음 시스템 카메라를 요청한다.
          return captureReceipt(true);
        }}
        onLibrary={() => {
          // 이미 찍은 영수증도 동일한 확인 절차로 연결한다.
          return captureReceipt(false);
        }}
      />
      <WorkspaceConfirmDialog
        userId={userId}
        confirmation={confirmation}
        onConfirm={confirmCommand}
        onCancel={cancelConfirmation}
      />
      <PlanEditor
        onRescan={() => {
          // 현재 확인 중인 원본 하나만 다시 요청한다.
          return requestScheduleExit(() => {
            // 수정한 초안을 버릴지 확인한 뒤 같은 원본을 다시 인식한다.
            return void receipt(form?.values.mediaId || '');
          });
        }}
        onReceipt={(camera) => {
          // 팝업을 닫지 않아 취소 시 입력을 유지하고 업로드 성공 시 영수증 확인으로 전환한다.
          requestScheduleExit(() => {
            // 영수증 작성으로 전환하기 전에 기존 변경 내용을 확인한다.
            return photo('receipt', camera);
          });
        }}
        userId={userId}
        form={form}
        snapshot={snapshot}
        busy={busy || scanning}
        error={error}
        locked={busy || scanning || hasPending || Boolean(confirmation)}
        feedback={feedback}
        onInvalid={invalidForm}
        onChange={change}
        onSave={save}
        onReload={reload}
        onClose={() => {
          // 저장 결과가 미확정이면 복구 전까지 폼을 유지한다.
          requestScheduleExit(() => {
            // 사용자가 명시적으로 버린 변경 내용만 해제한다.
            return setForm(null);
          });
        }}
      />
    </SafeAreaView>
  );
}
