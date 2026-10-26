import { useTripStore } from '@/stores/useTripStore';
import {
  FoundationClientError,
  sendWorkspaceCommand,
} from '@wherego/api-client';
import type { Profile, WorkspaceSnapshot } from '@wherego/domain';
import { type WorkspaceCommand } from '@wherego/validation';
import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { type PlanForm } from './forms';
import { receiptForm } from './receiptFlow';
import {
  scanServerReceipt,
  selectImage,
  serverOptions,
  uploadImage,
} from './service';
import { workspaceError } from './workspaceFailure';

export function receiptScanFailure(
  snapshot: WorkspaceSnapshot,
  mediaId: string,
  failure: unknown,
): PlanForm {
  // 공급자 원문·보안 설정을 노출하지 않고 보관된 사진의 재시도를 안내한다.
  const draft = receiptForm(snapshot, mediaId, undefined, 'error');
  return {
    ...draft,
    values: {
      ...draft.values,
      receiptError:
        failure instanceof FoundationClientError && failure.status === 429
          ? '스캔 횟수가 많아요. 잠시 후 다시 시도해 주세요. 하루 한도에 도달했다면 내일 다시 이용할 수 있어요. 원본 사진은 보관되어 있어요.'
          : '사진을 처리하지 못했어요. 잠시 후 다시 스캔하거나 글자가 선명한 사진을 선택해 주세요. 원본 사진은 보관되어 있어요.',
    },
  };
}

// 사진 선택·업로드·영수증 인식 행동을 구성한다.
export function useWorkspaceMediaActions({
  user,
  snapshot,
  setForm,
  scanning,
  setScanning,
  userId,
  setShowReceiptCapture,
  running: runningRef,
  pending,
  setBusy,
  setError,
  finishOperation,
  command,
}: {
  user: Profile | null;
  snapshot: WorkspaceSnapshot | undefined;
  setForm: Dispatch<SetStateAction<PlanForm | null>>;
  scanning: boolean;
  setScanning: Dispatch<SetStateAction<boolean>>;
  userId: string;
  setShowReceiptCapture: Dispatch<SetStateAction<boolean>>;
  running: RefObject<boolean>;
  pending: RefObject<(() => Promise<unknown>) | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  finishOperation: () => void;
  command: (
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
    fromForm?: boolean,
  ) => void;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const lifetimeRef = useRef<object | null>(null);
  useEffect(() => {
    lifetimeRef.current = { userId, tripId: snapshot?.trip.id };
    return () => {
      lifetimeRef.current = null;
    };
  }, [userId, snapshot?.trip.id]);

  const receipt = function receipt(mediaId: string): Promise<unknown> {
    // 권한·일정 스냅샷이 있는 현재 화면만 인식 요청을 시작한다.
    return user?.authProvider === 'guest' && snapshot
      ? Promise.resolve(
          setForm(receiptForm(snapshot, mediaId, undefined, 'manual')),
        )
      : scanning || !snapshot
        ? Promise.resolve()
        : beginReceiptScan(mediaId);
  };
  // 인식 중 화면과 실제 서버 요청 하나를 연결한다.
  const beginReceiptScan = function beginReceiptScan(
    mediaId: string,
  ): Promise<unknown> {
    const lifetime = lifetimeRef.current;
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
        return lifetime !== null &&
          lifetimeRef.current === lifetime &&
          useTripStore.getState().currentUser?.id === userId
          ? setForm(receiptForm(snapshot!, mediaId, draft))
          : undefined;
      })
      .catch((failure: unknown) => {
        // 실패를 빈 수동 입력 성공으로 대체하지 않고 재스캔을 안내한다.
        return lifetime !== null &&
          lifetimeRef.current === lifetime &&
          useTripStore.getState().currentUser?.id === userId
          ? setForm(receiptScanFailure(snapshot!, mediaId, failure))
          : undefined;
      })
      .finally(() => {
        // 완료 또는 실패 시에만 다음 사용자의 선택을 허용한다.
        if (lifetime !== null && lifetimeRef.current === lifetime)
          setScanning(false);
      });
  };
  // 사용자 선택 사진을 비공개 저장하고 용도 메타데이터를 등록한다.
  const captureReceipt = function captureReceipt(
    camera: boolean,
  ): Promise<void> {
    // 안내 화면 닫기와 실제 선택을 순서대로 진행한다.
    return Promise.resolve(setShowReceiptCapture(false)).then(() => {
      // 미리보기용 인식 결과를 만드는 대신 실제 이미지 선택을 시작한다.
      return photo('receipt', camera);
    });
  };

  // 사용자 선택 사진을 비공개 저장하고 용도 메타데이터를 등록한다.
  const photo = function photo(
    purpose: 'photo' | 'receipt',
    camera = false,
    scheduleId?: string,
  ): void {
    const lifetime = lifetimeRef.current;
    // 렌더링 이전 연속 선택을 막고 시작한 계정의 여행에만 사진을 저장한다.
    return !snapshot || runningRef.current || pending.current
      ? undefined
      : void ((runningRef.current = true),
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
              media &&
              lifetime !== null &&
              lifetimeRef.current === lifetime &&
              useTripStore.getState().currentUser?.id === userId
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
                              return lifetime !== null &&
                                lifetimeRef.current === lifetime &&
                                useTripStore.getState().currentUser?.id ===
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
            lifetime !== null &&
            lifetimeRef.current === lifetime &&
            useTripStore.getState().currentUser?.id === userId
              ? setError(workspaceError(failure))
              : undefined);
          }));
  };
  return { receipt, captureReceipt, photo };
}
