import ReceiptDetails from './ReceiptDetails';
import { receiptForm, receiptDateValues } from './receiptFlow';
import HaruState from '@/components/HaruState';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
  persistedTripCreateSchema,
  workspaceTripSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import type { WorkspaceExpense, WorkspaceSnapshot } from '@wherego/domain';
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
import GooglePlace from './GooglePlace';
import HomeScreen from './HomeScreen';
import { countryDefaults, travelCountries } from './countries';
import { useSharedSchedule } from './useSharedSchedule';
import {
  tripStatusLabel,
  memberRoleLabel,
  workspaceSections,
} from './presentation';

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
  return error instanceof FoundationClientError
    ? error.status === 409
      ? '다른 동행이 내용을 변경했습니다. 새로고침 후 다시 작성해 주세요.'
      : error.status === 401
        ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
        : error.status === 403
          ? '이 여행을 변경할 권한이 없습니다.'
          : error.status === 410
            ? '초대가 만료되었거나 취소되었습니다.'
            : error.status === 503
              ? '잠시 연결할 수 없어요. 조금 뒤에 다시 시도해 주세요.'
              : error.status === 422
                ? '입력값과 연결할 날짜·일정을 확인해 주세요.'
                : `저장 요청을 확인하지 못했습니다 (${error.status}). 같은 요청으로 재시도해 주세요.`
    : error instanceof TypeError
      ? '서버 응답을 확인하지 못했습니다. 연결을 확인하고 같은 요청으로 재시도해 주세요.'
      : error instanceof Error
        ? error.name === 'ZodError'
          ? '날짜, 필수 항목, 금액 형식을 확인해 주세요.'
          : error.message
        : '연결을 확인하고 재시도해 주세요.';
}
// 소수 금액을 정수 센트로 합산해 통화별로 표시한다.
function totals(expenses: WorkspaceExpense[], actual: boolean): string {
  // 환율 없이 다른 통화를 합치지 않는다.
  return (['KRW', 'JPY', 'USD'] as const)
    .map((currency) => {
      // 서버의 소수 문자열을 정확하게 누적한다.
      return `${currency} ${expenses
        .filter((item) => {
          // 예상과 실제 비용을 별도로 계산한다.
          return item.currency === currency && item.isActual === actual;
        })
        .reduce((sum, item) => {
          // 두 자리 소수를 센트 정수로 변환한다.
          return (
            sum +
            BigInt(
              (item.amount.split('.')[0] || '0') +
                (item.amount.split('.')[1] || '').padEnd(2, '0'),
            )
          );
        }, 0n)
        .toString()
        .replace(/(\d{2})$/, '.$1')
        .replace(/^\./, '0.')}`;
    })
    .join(' · ');
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
  // React key로 이전 계정의 입력·요청 클로저를 남기지 않는다.
  return (
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
  const userId = user && user.authProvider !== 'guest' ? user.id : '';
  const [form, setForm] = useState<PlanForm | null>(
    creating ? () => newTripForm(destination) : null,
  );
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState('');
  // 여행 계획과 현장 기록을 작업별 영역으로 나눈다.
  const [activeSection, setActiveSection] = useState(
    section === 'share' ? 'share' : 'itinerary',
  );
  const [selectedDay, setSelectedDay] = useState('');
  const [showTripSettings, setShowTripSettings] = useState(false);
  const pending = useRef<null | (() => Promise<unknown>)>(null);
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
    return cache.invalidateQueries({ queryKey: ['wherego', userId] });
  }
  // 충돌 자료를 다시 읽되 작성한 폼을 보존한다.
  function reload(): void {
    // 사용자 확인 후 최신 버전으로 새 요청을 작성할 수 있다.
    pending.current = null;
    setHasPending(false);
    setError('');
    void refresh();
  }
  // 저장 중 또는 응답을 잃은 요청은 같은 클로저로 재시도한다.
  function execute(task: () => Promise<unknown>): void {
    // 다른 요청과 중복 실행하지 않는다.
    if (busy) return;
    // 요청의 UUID·본문·버전은 성공 전까지 보존한다.
    pending.current = task;
    setHasPending(true);
    setBusy(true);
    setError('');
    task()
      .then(() => {
        // 계정 전환 후 이전 화면의 완료를 적용하지 않는다.
        if (useTripStore.getState().currentUser?.id !== userId) return;
        // 확인된 성공만 대기 요청을 제거한다.
        pending.current = null;
        setHasPending(false);
        setForm(null);
        return refresh();
      })
      .catch((failure: unknown) => {
        // 실패 시 폼·원본·요청 키를 그대로 유지한다.
        setError(workspaceError(failure));
      })
      .finally(() => {
        // 성공·실패 모두 조작 가능 상태로 복귀한다.
        setBusy(false);
      });
  }
  // 현재 버전에 명령 하나를 저장한다.
  function command(
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
  ): void {
    // 재시도할 때 변하지 않는 요청 키와 버전을 캡처한다.
    if (!snapshot || pending.current || busy) return;
    const key = Crypto.randomUUID();
    const version = snapshot.trip.version;
    const tripId = snapshot.trip.id;
    execute(() => {
      // 최신 인증 토큰으로 같은 업무 요청을 재전송한다.
      return serverOptions(userId)
        .then((options) => {
          // 서버에서 역할·부모 ID·버전을 검사한다.
          return sendWorkspaceCommand(options, tripId, version, value, key);
        })
        .then((result) => {
          // 공유 등 저장 후 사용자 동작은 성공 결과로만 수행한다.
          return after ? after(result) : result;
        });
    });
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
    // 실패한 모달에서도 동일 본문·요청 키의 저장을 재개한다.
    if (pending.current) {
      execute(pending.current);
      return;
    }
    // 유효하지 않은 폼은 네트워크 요청 전에 안내한다.
    try {
      // 기존 여행은 공통 명령 계약으로 저장한다.
      if (!form || busy || pending.current) return;
      if (form.kind !== 'trip') {
        // 화면 폼이 선택한 일정·날짜를 검증한다.
        if (snapshot)
          command(
            formCommand(form, snapshot),
            form.kind === 'receipt'
              ? receiptRegistered.bind(null, form.values.dayId || '')
              : undefined,
          );
        return;
      }
      // 국가 오류는 다른 필수 항목 오류와 구분하여 안내한다.
      if (
        !travelCountries.some((item) => {
          // 여행금지·미등록 국가명은 생성 요청으로 보내지 않는다.
          return item.country === form.values.country;
        })
      )
        return setError('검색 결과에서 여행 가능한 국가를 선택해 주세요.');
      const input = persistedTripCreateSchema.parse({
        title: form.values.title,
        country: form.values.country,
        city: form.values.city,
        startDate: form.values.startDate,
        endDate: form.values.endDate,
        timezone: form.values.timezone,
        defaultCurrency: form.values.defaultCurrency,
        ...(form.values.flightSkipped === 'true'
          ? {}
          : {
              flight: {
                number: form.values.flightNumber,
                departure: form.values.flightDeparture,
                arrival: form.values.flightArrival,
                time: form.values.flightTime || '',
              },
            }),
        coverColor: '#246A54',
      });
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
            router.replace(
              `/trips/${z.object({ trip: workspaceTripSchema }).parse(result.data).trip.id}${importing ? '?importPlace=1' : ''}`,
            );
          });
      });
    } catch (failure) {
      // 입력 오류에서는 작성 내용을 버리지 않는다.
      setError(workspaceError(failure));
    }
  }
  // 폼 필드 하나를 바꾸되 연결 일정의 DAY를 일치시킨다.
  function change(key: string, value: string): void {
    // 불확실한 저장 응답이 있는 동안 요청 본문을 고정한다.
    if (busy || pending.current) return;
    setForm((previous) => {
      // 기존 폼의 식별자와 다른 필드는 보존한다.
      return previous
        ? {
            ...previous,
            values: {
              ...previous.values,
              [key]: value,
              ...(previous.kind === 'trip' &&
              key === 'country' &&
              previous.values.country !== value
                ? countryDefaults(value)
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
    return scanning || !snapshot
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
  function photo(
    purpose: 'photo' | 'receipt',
    camera = false,
    scheduleId?: string,
  ): void {
    // 저장 대기 상태에서는 다른 업로드를 시작하지 않는다.
    if (!snapshot || busy || pending.current) return;
    setBusy(true);
    setError('');
    selectImage(camera)
      .then((asset) => {
        // 취소하면 파일이나 DB 기록을 만들지 않는다.
        return asset ? uploadImage(snapshot.trip.id, asset) : null;
      })
      .then((media) => {
        // 업로드 완료 후 같은 메타데이터 등록 명령을 재시도할 수 있다.
        setBusy(false);
        if (media)
          command(
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
                  setTimeout(() => {
                    // execute의 성공 폼 초기화 이후 영수증 폼을 시작한다.
                    void receipt(media.id);
                  }, 0);
                  return Promise.resolve();
                }
              : undefined,
          );
      })
      .catch((failure: unknown) => {
        // 업로드 실패는 성공 사진으로 표시하지 않는다.
        setError(workspaceError(failure));
        setBusy(false);
      });
  }
  // 준비물 완료 명령을 동일 요청 키로 실행한다.
  function check(item: { id: string; isCompleted: boolean }): void {
    // 뷰어와 저장 대기 상태의 쓰기를 차단한다.
    if (!snapshot || !writable || busy || pending.current) return;
    const key = Crypto.randomUUID();
    execute(() => {
      // 완료 상태는 반전 요청 대신 명시값을 저장한다.
      return serverOptions(userId).then((options) => {
        // 기존 준비물 API도 동일 버전 계약을 사용한다.
        return setFoundationChecklist(
          options,
          snapshot.trip.id,
          item.id,
          !item.isCompleted,
          snapshot.trip.version,
          key,
        );
      });
    });
  }
  // 새 준비물을 실제 서버에 저장한다.
  function addCheck(): void {
    // 빈 제목과 동시 요청은 무시한다.
    if (!snapshot || !checklist.trim() || busy || pending.current) return;
    const key = Crypto.randomUUID();
    const title = checklist.trim();
    execute(() => {
      // 재시도 본문을 최초 입력으로 고정한다.
      return serverOptions(userId).then((options) => {
        // 저장된 여행 버전에 준비물을 추가한다.
        return addFoundationChecklist(
          options,
          snapshot.trip.id,
          title,
          snapshot.trip.version,
          key,
        );
      });
    });
  }
  // 편집 모달 하나를 연다.
  function edit(next: PlanForm): void {
    // 재시도 중인 요청과 새 폼을 섞지 않는다.
    if (busy || pending.current) return;
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
    return router.canGoBack() ? router.back() : router.replace('/(tabs)');
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
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {id && (
          <Action
            label="내 여행 목록"
            variant="quiet"
            onPress={() => {
              // 상세 페이지에서도 명시적인 돌아가기 경로를 제공한다.
              return router.replace('/(tabs)');
            }}
          />
        )}
        <Text style={styles.header}>{id ? '나의 여행' : '여행 계획'}</Text>
        <Text style={styles.subtitle}>
          함께 계획하고, 사진과 비용으로 여행을 기록하세요.
        </Text>
        {!userId ? (
          <View style={styles.card}>
            <Text style={styles.title}>로그인하고 여행을 시작하세요</Text>
            <Text>
              이메일로 로그인하면 여행을 저장하고 친구와 함께 계획할 수 있어요.
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
                    : '/login',
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
              <HaruState
                kind="error"
                title="여행을 불러오지 못했어요"
                description={workspaceError(trips.error || workspace.error)}
              >
                <Action label="여행 다시 불러오기" onPress={reload} />
              </HaruState>
            )}
            {snapshot && (
              <>
                {importing && !writable && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    읽기 전용 또는 보관된 여행에는 장소를 추가할 수 없습니다.
                    편집 가능한 여행을 선택해 주세요.
                  </Text>
                )}
                <View style={styles.card}>
                  <Text style={styles.title}>{snapshot.trip.title}</Text>
                  <Text>
                    {snapshot.trip.country} · {snapshot.trip.city}
                  </Text>
                  <Text>
                    {snapshot.trip.startDate} ~ {snapshot.trip.endDate}
                  </Text>
                  <Text style={styles.badge}>
                    {tripStatusLabel(snapshot.trip.status)} ·{' '}
                    {memberRoleLabel(snapshot.myRole)}
                  </Text>
                  {snapshot.trip.status === 'COMPLETED' && (
                    <Action
                      label="발자국 다이어리 보기"
                      onPress={() => {
                        // 종료된 여행의 일정·사진·비용을 날짜별로 읽는다.
                        return router.push(`/diary/${snapshot.trip.id}`);
                      }}
                    />
                  )}
                  {owner && (
                    <Action
                      label="여행 설정"
                      variant="quiet"
                      selected={showTripSettings}
                      onPress={() => {
                        // 목적지와 기간 관리는 필요할 때만 펼친다.
                        return setShowTripSettings(!showTripSettings);
                      }}
                    />
                  )}
                  {owner && showTripSettings && (
                    <Action
                      label="여행 정보 / 종료 상태"
                      disabled={busy || scanning || hasPending}
                      onPress={() => {
                        // 여행 종료는 소유자가 명시적으로 저장한다.
                        edit({
                          kind: 'metadata',
                          id: Crypto.randomUUID(),
                          values: {
                            title: snapshot.trip.title,
                            country: snapshot.trip.country,
                            city: snapshot.trip.city,
                            status: snapshot.trip.status,
                          },
                        });
                      }}
                    />
                  )}
                  {owner && showTripSettings && (
                    <Action
                      label="여행 기간 변경"
                      disabled={busy || scanning || hasPending}
                      onPress={() => {
                        // 기간 변경은 DAY 순서별로 기존 일정을 이동한다.
                        edit({
                          kind: 'period',
                          id: Crypto.randomUUID(),
                          values: {
                            startDate: snapshot.trip.startDate,
                            endDate: snapshot.trip.endDate,
                          },
                        });
                      }}
                    />
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                  accessibilityLabel="여행 작업 영역"
                >
                  {workspaceSections
                    .filter(([key]) => {
                      // 공개 영역은 여행 소유자에게만 제공한다.
                      return key !== 'share' || owner;
                    })
                    .map(([key, label]) => (
                      <Action
                        key={key}
                        label={label}
                        selected={activeSection === key}
                        onPress={() => {
                          // 다른 영역의 원본과 입력을 유지하며 선택한 내용만 표시한다.
                          return setActiveSection(key);
                        }}
                      />
                    ))}
                </ScrollView>
                {['itinerary', 'expenses', 'photos'].includes(
                  activeSection,
                ) && (
                  <View style={styles.row}>
                    {activeSection === 'itinerary' && (
                      <Action
                        variant="primary"
                        label="일정 추가"
                        disabled={!writable || busy || scanning || hasPending}
                        onPress={() => {
                          // 첫 DAY를 기본 선택하되 사용자에게 날짜 선택을 제공한다.
                          edit(scheduleForm(snapshot, undefined, selectedDay));
                        }}
                      />
                    )}
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
                        // QR 대신 사진 촬영으로 인식한다.
                        photo('receipt', true);
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
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                      accessibilityLabel="여행 날짜 선택"
                    >
                      {snapshot.days.map((day) => (
                        <Action
                          key={day.id}
                          label={`DAY ${day.dayNumber}`}
                          selected={
                            day.id === (selectedDay || snapshot.days[0]?.id)
                          }
                          onPress={() => {
                            // 선택한 날짜의 일정만 보여준다.
                            return setSelectedDay(day.id);
                          }}
                        />
                      ))}
                    </ScrollView>
                    <Action
                      label="Google Maps 장소 가져오기"
                      variant="quiet"
                      onPress={() => {
                        // 저장한 지도 장소를 여행에 가져오는 확인 화면을 연다.
                        return router.push('/import-place');
                      }}
                    />
                    {snapshot.days
                      .filter((day) => {
                        // 기간 변경으로 선택 날짜가 사라지면 첫 날짜를 표시한다.
                        return (
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
                        <View key={day.id} style={styles.card}>
                          <Text style={styles.title}>
                            DAY {day.dayNumber} · {day.tripDate}
                          </Text>
                          {!snapshot.itinerary.some((item) => {
                            // 장소가 없는 날짜에는 다음 행동을 안내한다.
                            return item.dayId === day.id;
                          }) && (
                            <Text style={styles.subtitle}>
                              이날의 첫 장소를 추가해 보세요. 숙소, 맛집,
                              관광지와 이동을 함께 계획할 수 있어요.
                            </Text>
                          )}
                          {snapshot.itinerary
                            .filter((item) => {
                              // 날짜별 정렬은 서버에서 확정한 순서를 따른다.
                              return item.dayId === day.id;
                            })
                            .map((item) => (
                              <View key={item.id} style={{ gap: 8 }}>
                                <Text style={styles.title}>
                                  {item.timeSlot || '시간 미정'} · {item.title}
                                </Text>
                                <Text>{item.address || '지역명 미등록'}</Text>
                                {item.googlePlaceId && (
                                  <GooglePlace
                                    userId={userId}
                                    placeId={item.googlePlaceId}
                                    label={item.title}
                                  />
                                )}
                                {item.memo && <Text>{item.memo}</Text>}
                                <View style={styles.row}>
                                  <Action
                                    label="이 일정에서 사진 촬영"
                                    disabled={
                                      !writable ||
                                      busy ||
                                      scanning ||
                                      hasPending
                                    }
                                    onPress={() => {
                                      // 맛집·관광지 현장에서 촬영한 사진을 현재 일정에 연결한다.
                                      return photo('photo', true, item.id);
                                    }}
                                  />
                                  <Action
                                    label="이 일정에 사진 추가"
                                    disabled={
                                      !writable ||
                                      busy ||
                                      scanning ||
                                      hasPending
                                    }
                                    onPress={() => {
                                      // 일정과 같은 여행에만 사진을 연결한다.
                                      photo('photo', false, item.id);
                                    }}
                                  />
                                  <Action
                                    label="일정 수정"
                                    disabled={
                                      !writable ||
                                      busy ||
                                      scanning ||
                                      hasPending
                                    }
                                    onPress={() => {
                                      // 기존 일정 ID를 유지한다.
                                      edit(scheduleForm(snapshot, item));
                                    }}
                                  />
                                  <Action
                                    variant="danger"
                                    label="일정 삭제"
                                    disabled={
                                      !writable ||
                                      busy ||
                                      scanning ||
                                      hasPending
                                    }
                                    onPress={() => {
                                      // 영수증 연결 일정의 삭제는 서버 FK가 보호한다.
                                      command({
                                        operation: 'schedule.delete',
                                        input: { id: item.id },
                                      });
                                    }}
                                  />
                                </View>
                              </View>
                            ))}
                        </View>
                      ))}
                  </>
                )}
                {activeSection === 'expenses' && (
                  <View style={styles.card}>
                    <Text style={styles.title}>비용</Text>
                    <Text>실제: {totals(snapshot.expenses, true)}</Text>
                    <Text>예상: {totals(snapshot.expenses, false)}</Text>
                    {snapshot.expenses.map((item) => (
                      <View key={item.id}>
                        <Text>
                          {item.title} · {item.amount} {item.currency} ·{' '}
                          {item.isActual ? '실제' : '예상'}
                        </Text>
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
                          disabled={!writable || busy || scanning || hasPending}
                          onPress={() => {
                            // 게시 사진과 영수증 참조는 서버가 삭제를 제한한다.
                            command(
                              {
                                operation: 'media.delete',
                                input: { id: media.id },
                              },
                              (result) => {
                                // 참조 해제를 확인한 뒤 같은 경로의 실제 원본도 제거한다.
                                return removeImage(result.path!);
                              },
                            );
                          }}
                        />
                      </View>
                    ))}
                  </View>
                )}
                {activeSection === 'preparation' && (
                  <View style={styles.card}>
                    <Text style={styles.title}>준비물</Text>
                    {snapshot.checklists.map((item) => (
                      <Action
                        key={item.id}
                        label={`${item.isCompleted ? '✓ ' : '□ '}${item.title}`}
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
                          value={checklist}
                          onChange={setChecklist}
                        />
                        <Action
                          label="준비물 추가"
                          disabled={busy || scanning || hasPending}
                          onPress={addCheck}
                        />
                      </>
                    )}
                  </View>
                )}
                {activeSection === 'companions' && (
                  <View style={styles.card}>
                    <Text style={styles.title}>동행</Text>
                    {snapshot.members.map((member) => (
                      <View key={member.memberId}>
                        <Text>
                          {member.nickname} · {memberRoleLabel(member.role)}
                          {member.isMe ? ' (나)' : ''}
                        </Text>
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
                        {snapshot.invites.map((item) => (
                          <View key={item.id}>
                            <Text>
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
            label="같은 요청으로 재시도"
            onPress={() => {
              // 저장 여부가 불확실한 요청을 중복 생성하지 않는다.
              if (pending.current) execute(pending.current);
            }}
          />
        )}
        {busy && <Text>요청을 확인하고 있습니다…</Text>}
      </ScrollView>
      <PlanEditor
        onRescan={() => {
          // 현재 확인 중인 원본 하나만 다시 요청한다.
          return void receipt(form?.values.mediaId || '');
        }}
        onReceipt={(camera) => {
          // 팝업을 닫지 않아 취소 시 입력을 유지하고 업로드 성공 시 영수증 확인으로 전환한다.
          photo('receipt', camera);
        }}
        userId={userId}
        form={form}
        snapshot={snapshot}
        busy={busy || scanning}
        error={error}
        onChange={change}
        onSave={save}
        onReload={reload}
        onClose={() => {
          // 불확실한 저장 요청은 폼을 닫아도 재시도 버튼에 보존한다.
          setForm(null);
        }}
      />
    </SafeAreaView>
  );
}
