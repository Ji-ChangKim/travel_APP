import { useTripStore } from '@/stores/useTripStore';
import {
  createFoundationTrip,
  sendWorkspaceCommand,
} from '@wherego/api-client';
import type { WorkspaceSnapshot } from '@wherego/domain';
import {
  workspaceTripSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { z } from 'zod';
import { cityTimezones } from './destinationCatalog';
import {
  formFailureFields,
  formInputFields,
  revisedFormFeedback,
  type FieldErrors,
  type FormFeedbackState,
} from './formFeedback';
import { formCommand, type PlanForm } from './forms';
import { receiptConfirmationValues, receiptDateValues } from './receiptFlow';
import { completeFormExit } from './scheduleExitGuard';
import { serverOptions } from './service';
import { tripCreationInput } from './tripCreation';
import { countryChangeValues } from './tripMetadata';
import { type WorkspaceConfirmation } from './workspaceConfirmation';
import { workspaceError } from './workspaceFailure';

// 여행 작성 행동에 필요한 상태와 실행 경로의 계약이다.
type WorkspaceFormActionOptions = {
  setSelectedDay: Dispatch<SetStateAction<string>>;
  setActiveSection: Dispatch<SetStateAction<string>>;
  running: RefObject<boolean>;
  scanning: boolean;
  confirming: RefObject<{
    details: WorkspaceConfirmation;
    fromForm: boolean;
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>;
  } | null>;
  pending: RefObject<(() => Promise<unknown>) | null>;
  execute: (task: () => Promise<unknown>) => void;
  form: PlanForm | null;
  busy: boolean;
  snapshot: WorkspaceSnapshot | undefined;
  command: (
    value: WorkspaceCommand,
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>,
    fromForm?: boolean,
  ) => void;
  userId: string;
  setError: Dispatch<SetStateAction<string>>;
  setFeedback: Dispatch<SetStateAction<FormFeedbackState>>;
  clearPending: () => void;
  setForm: Dispatch<SetStateAction<PlanForm | null>>;
  finishOperation: () => void;
  router: ImperativeRouter;
  importing: boolean;
};

// 입력 검증·여행 생성·필드 변경 행동을 구성한다.
export function useWorkspaceFormActions({
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
}: WorkspaceFormActionOptions) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const receiptRegistered = function receiptRegistered(
    dayId: string,
  ): Promise<void> {
    // 서버에서 성공한 등록에만 날짜와 일정 탭을 변경한다.
    return Promise.resolve(setSelectedDay(dayId)).then(() => {
      // 영수증에서 생성된 여행 기록을 바로 확인한다.
      return setActiveSection('itinerary');
    });
  };
  // 새 여행 또는 기존 여행 폼을 확정한다.
  const save = function save(): void {
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
  };
  // 필드 안내를 갱신하고 새 검증 시도에서 첫 오류로 이동한다.
  const invalidForm = function invalidForm(fields: FieldErrors): void {
    // 오류를 고칠 때까지 입력 내용과 폼 식별자를 보존한다.
    return void (setFeedback((previous) => {
      /* 명시 제출에서만 이동 순번을 올린다. */ return {
        fields,
        attempt: previous.attempt + 1,
      };
    }),
    setError('입력한 항목을 확인해 주세요. 작성한 내용은 그대로 있어요.'));
  };
  // 생성 성공 후에만 작성 수명을 해제하고 서버 여행으로 이동한다.
  const createdTrip = function createdTrip(tripId: string): void {
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
  };
  // 폼 필드 하나를 바꾸되 연결 일정의 DAY를 일치시킨다.
  const change = function change(key: string, value: string): void {
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
              ...(key === 'newReceiptPlace' && previous.kind === 'receipt'
                ? { scheduleId: '' }
                : {}),
              ...(key === 'scheduleId' && previous.kind === 'receipt'
                ? { newReceiptPlace: 'false' }
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
  };
  return { save, invalidForm, change };
}
