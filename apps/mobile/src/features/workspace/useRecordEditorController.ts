import { useQueryClient } from '@tanstack/react-query';
import {
  FoundationClientError,
  foundationQueryKey,
  getWorkspace,
} from '@wherego/api-client';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { recordDetails } from './recordDetails';
import type { FormFeedbackState } from './formFeedback';
import { formCommand, scheduleForm, type PlanForm } from './forms';
import {
  canDiscardRecordAttempt,
  recordFailureMessage,
  recordFieldErrors,
} from './recordFailure';
import { useRecordPersistence } from './recordPersistence';
import { completeFormExit, useScheduleExitGuard } from './scheduleExitGuard';
import { selectImage, serverOptions, uploadImage } from './service';

import type { PendingRecord } from './RecordEditorScreen';

// 현재 계정과 편집 요청의 수명을 관리하고 표시용 상태·행동을 반환한다.
export function useRecordEditorController({
  snapshot,
  item,
  userId,
  onChoose,
  onAccessDenied,
}: {
  snapshot: WorkspaceSnapshot;
  item: WorkspaceSchedule;
  userId: string;
  onChoose: () => void;
  onAccessDenied: (failure: FoundationClientError) => void;
}) {
  // 새 조회로 폼을 조용히 덮어쓰지 않고 처음 편집한 버전을 고정한다.
  const [form, setForm] = useState<PlanForm | null>(() =>
    scheduleForm(snapshot, item),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryPending, setRetryPending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FormFeedbackState>({
    fields: {},
    attempt: 0,
  });
  const scroll = useRef<ScrollView>(null);
  const version = useRef(snapshot.trip.version);
  const pending = useRef<PendingRecord | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const router = useRouter();
  const cache = useQueryClient();
  useScheduleExitGuard(form, busy || Boolean(deleting), setForm);
  useEffect(() => {
    // 저장 잠금과 화면 뒤로가기 차단이 해제된 렌더에서만 기록 화면으로 이동한다.
    if (saved && !busy)
      completeFormExit(() => router.replace(`/diary/${snapshot.trip.id}`));
  }, [saved, busy, router, snapshot.trip.id]);
  useEffect(() => {
    // 화면 종료 후 이전 요청의 UI/이동 결과를 폐기한다.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { current, execute } = useRecordPersistence({
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
  });
  async function run(task: () => Promise<void>): Promise<void> {
    // React 재렌더 전에도 중복 제출과 사진 선택을 막는다.
    if (locked.current || !current()) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (failure) {
      if (!current()) return;
      if (
        failure instanceof FoundationClientError &&
        [401, 403, 404].includes(failure.status)
      ) {
        pending.current = null;
        onAccessDenied(failure);
        return;
      }
      const mapped = recordFieldErrors(failure);
      setFeedback((previous) => {
        // 제출 시에만 첫 오류로 이동하고 입력 원문은 보존한다.
        return { fields: mapped, attempt: previous.attempt + 1 };
      });
      const known = canDiscardRecordAttempt(failure);
      if (known) pending.current = null;
      setRetryPending(Boolean(pending.current));
      setError(
        recordFailureMessage(
          failure,
          Object.keys(mapped).length > 0,
          Boolean(pending.current),
        ),
      );
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  }
  function change(key: string, value: string): void {
    // 저장 결과 미확인 중에는 이전 전송 원문을 수정하지 않는다.
    return busy || retryPending
      ? undefined
      : setForm((previous) => {
          // 선택한 필드만 바꾸고 기존 DAY/위치/후보/항공 정보를 유지한다.
          return previous
            ? { ...previous, values: { ...previous.values, [key]: value } }
            : previous;
        });
  }
  async function photo(): Promise<void> {
    // 실제 파일을 선택한 뒤 기존 비공개 업로드/연결 명령을 사용한다.
    const asset = await selectImage(false);
    if (!asset || !current()) return;
    const media = await uploadImage(userId, snapshot.trip.id, asset);
    if (!current()) return;
    await execute({
      operation: 'media.register',
      input: { ...media, purpose: 'photo', scheduleId: item.id },
    });
  }
  async function reload(): Promise<void> {
    // 명시적으로 초안을 버린 뒤 최신 버전과 모든 원본 필드를 함께 갱신한다.
    const fresh = await serverOptions(userId)
      .then((options) => {
        // 인증 복원 실패도 같은 원본 복구 경로에서 처리한다.
        return getWorkspace(options, snapshot.trip.id);
      })
      .catch((failure: unknown) => {
        // 새 조회가 실패해도 빈 로딩 화면에 갇히지 않고 마지막 저장 원본으로 돌아간다.
        if (current()) setForm(scheduleForm(snapshot, item));
        throw failure;
      });
    if (!current()) return;
    cache.setQueryData(
      foundationQueryKey(userId, 'workspace', snapshot.trip.id),
      fresh,
    );
    const saved = fresh.itinerary.find((entry) => {
      // 삭제된 일정은 다른 항목으로 바꿔 편집하지 않는다.
      return entry.id === item.id;
    });
    if (!saved) return;
    version.current = fresh.trip.version;
    pending.current = null;
    setRetryPending(false);
    setForm(scheduleForm(fresh, saved));
  }
  function saveRecord(): void {
    // 재시도는 전송 원문을 유지하고 새 저장만 현재 폼에서 명령을 만든다.
    return void run(() => {
      // 폼이 닫힌 뒤에는 새 저장 명령을 만들지 않는다.
      return form
        ? execute(pending.current?.command || formCommand(form, snapshot))
        : Promise.resolve();
    });
  }
  function deletePhoto(): void {
    // 확인한 사진의 삭제와 잠금·멱등·계정 보호를 함께 처리한다.
    return void run(async () => {
      // 확인창에 남아 있는 ID만 실제 서버에서 삭제한다.
      if (!deleting) return;
      await execute({ operation: 'media.delete', input: { id: deleting } });
      if (current()) setDeleting(null);
    });
  }
  const { photos, costs } = recordDetails(snapshot, item.id);

  // 화면에는 요청 원문과 잠금 참조 대신 준비된 상태와 행동을 전달한다.
  return {
    form,
    busy,
    retryPending,
    feedback,
    scroll,
    snapshot,
    item,
    onChoose,
    photos,
    userId,
    setDeleting,
    run,
    photo,
    change,
    costs,
    router,
    notice,
    error,
    reload,
    saveRecord,
    deleting,
    deletePhoto,
  };
}
