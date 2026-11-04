import * as Crypto from 'expo-crypto';
import { Linking } from 'react-native';
import { z } from 'zod';
import type {
  ItineraryItem,
  TrailJourney,
  TrailPlan,
  TrailReceipt,
  Trip,
} from '@wherego/domain';
import {
  trailFlightSchema,
  trailJourneySchema,
  trailPlanSchema,
  trailReceiptSchema,
  foundationUuidSchema,
  calendarDateSchema,
} from '@wherego/validation';
import { UserFacingError, userFacingMessage } from '@/services/userFacingError';
import { useTripStore } from '@/stores/useTripStore';
import {
  applyTrailFlight,
  applyTrailPlan,
  applyTrailReceipt,
  flightSearchUrl,
  removeTrailPlan,
} from './model';
import {
  cleanupTrailAttachment,
  openTrailAttachment,
  pickTrailAttachment,
} from './storage';
import { saveTrailJourney, useTrailStore } from './store';
import { selectedJourney } from './trailSelectors';
import type { TrailEditor, TrailForm, TrailModel } from './trailTypes';

// 저장하지 않은 임시 첨부를 정리한 뒤 편집창을 닫는다.
export function closeEditor(model: TrailModel): void {
  // 저장 중 폼이 닫혀 완료 여부를 놓치지 않게 한다.
  if (useTrailStore.getState().saving) return;
  model.editorSession.current.revision += 1;
  runAction(model, async () => {
    // 이미 저장된 원본은 참조 검사로 보존된다.
    await cleanupTrailAttachment(model.attachment[0], attachmentReferences());
    if (model.editorSession.current.active) model.editor[1](null);
  });
}

// 현재 저장된 모든 영수증 원본 참조를 확인한다.
function attachmentReferences(): string[] {
  // 같은 파일이 다른 콘텐츠에 연결되어 있으면 보존한다.
  return useTrailStore.getState().journeys.flatMap((journey) => {
    return journey.receipts.map((receipt) => {
      return receipt.attachment.uri;
    });
  });
}

// 기존 여행의 장소 계획을 콘텐츠로 복사한다.
export function importTrip(model: TrailModel, trip: Trip): void {
  // 날짜나 장소가 잘못된 원본은 숨겨서 가져오지 않는다.
  return runAction(model, () => {
    return saveTrailJourney(model.scope, importedJourney(trip)).then(() => {
      return savedEditor(model);
    });
  });
}

// 복사할 여행과 하위 일정의 계약을 구성한다.
function importedJourney(trip: Trip): TrailJourney {
  return {
    ...trailJourneySchema.parse(trip),
    id: Crypto.randomUUID(),
    sourceTripId: trip.id,
    flights: [],
    receipts: [],
    plans: (useTripStore.getState().itineraries[trip.id] ?? []).map((item) => {
      return importedPlan(trip, item);
    }),
  };
}

// 예전 DAY 번호와 장소 정보를 새 계획에 매핑한다.
function importedPlan(trip: Trip, item: ItineraryItem): TrailPlan {
  // 임의 좌표는 복사하지 않고 사용자 장소 정보만 유지한다.
  return {
    id: Crypto.randomUUID(),
    ...trailPlanSchema.parse({
      date: importedPlanDate(trip, item),
      time: item.timeSlot ?? '09:00',
      title: item.title || item.place?.name || '장소 계획',
      address: item.place?.address ?? '',
      memo: item.memo ?? '',
    }),
  };
}

// 기존 계획의 DAY 번호를 범위 안에서 검증한다.
function importedPlanDate(trip: Trip, item: ItineraryItem): string {
  // 알 수 없는 DAY ID를 DAY1로 조용히 변환하지 않는다.
  return new Date(
    Date.parse(trip.startDate) +
      (z.coerce
        .number()
        .int()
        .min(1)
        .max(
          (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000 +
            1,
        )
        .parse(/^day-([1-9]\d*)$/.exec(item.tripDayId)?.[1]) -
        1) *
        86400000,
  )
    .toISOString()
    .slice(0, 10);
}

// 여행 선택과 폼 닫기를 순서대로 연결한다.
export function selectJourney(model: TrailModel, id: string): void {
  // 이전 여행의 입력이 다음 여행에 저장되지 않게 한다.
  model.editorSession.current.revision += 1;
  model.active[1](id);
  model.editor[1](null);
}

// 원본 첨부를 플랫폼에서 지원하는 뷰어로 연다.
export function openAttachment(
  model: TrailModel,
  attachment: TrailReceipt['attachment'],
): void {
  // 네이티브 URI 열기 오류도 입력 화면에 안내한다.
  return runAction(model, () => {
    return openTrailAttachment(attachment);
  });
}

// 입력 폼을 새로운 여행 행동에 맞춰 초기화한다.
export function openEditor(
  model: TrailModel,
  editor: TrailEditor,
  form: TrailForm,
): void {
  if (useTrailStore.getState().saving) return;
  model.editorSession.current.revision += 1;
  // 폼·첨부·편집 모드의 갱신 순서를 유지해 이전 원본이 새 입력에 연결되지 않게 한다.
  model.form[1](form);
  model.attachment[1](null);
  model.editor[1](editor);
}

// 입력 필드 하나만 수정한다.
export function updateField(
  model: TrailModel,
  key: string,
  value: string,
): void {
  return model.form[1]((current) => {
    return { ...current, [key]: value };
  });
}

// 취소와 파일 선택 실패를 구분한다.
export function pickAttachment(model: TrailModel): void {
  const session = model.editorSession.current;
  if (!session.active || session.picking || useTrailStore.getState().saving)
    return;
  const revision = session.revision;
  session.picking = true;
  model.attachmentPending[1](true);
  runAction(model, async () => {
    try {
      // 취소 시 이전 첨부는 유지하고 늦게 선택된 원본은 참조를 확인해 정리한다.
      const attachment = await pickTrailAttachment();
      if (!attachment) return;
      if (session.active && session.revision === revision)
        await cleanupTrailAttachment(
          model.attachment[0],
          attachmentReferences(),
        );
      if (!session.active || session.revision !== revision) {
        await cleanupTrailAttachment(attachment, attachmentReferences());
        return;
      }
      model.attachment[1](attachment);
    } finally {
      session.picking = false;
      if (session.active) model.attachmentPending[1](false);
    }
  });
}

// 편명과 실제 운항 날짜를 검색한다.
export function searchFlight(model: TrailModel): void {
  return runAction(model, () => {
    return Linking.openURL(
      flightSearchUrl(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/)
          .parse(model.form[0].flightNumber),
        calendarDateSchema.parse(model.form[0].searchDate),
      ),
    );
  });
}

// 폼을 검증하고 콘텐츠 한 개를 저장한다.
export function submitEditor(model: TrailModel): void {
  if (model.editorSession.current.picking) return;
  // 실패 시 폼을 유지하고 성공 후에만 닫는다.
  return runAction(model, () => {
    return saveTrailJourney(model.scope, editedJourney(model)).then(() => {
      return savedEditor(model);
    });
  });
}

// 모드에 맞는 저장 결과를 생성한다.
function editedJourney(model: TrailModel): TrailJourney {
  return model.editor[0] === 'journey'
    ? {
        ...trailJourneySchema.parse(model.form[0]),
        id: Crypto.randomUUID(),
        flights: [],
        plans: [],
        receipts: [],
      }
    : editSelectedJourney(model, requiredJourney(model));
}

// 편집 대상 여행이 실제로 선택되어 있는지 확인한다.
function requiredJourney(model: TrailModel): TrailJourney {
  const journey = selectedJourney(model);
  if (!journey) throw new UserFacingError('먼저 여행을 선택해 주세요.');
  return journey;
}

// 여행 내부의 한 유형만 수정한다.
function editSelectedJourney(
  model: TrailModel,
  journey: TrailJourney,
): TrailJourney {
  return model.editor[0] === 'flight'
    ? applyTrailFlight(journey, {
        ...trailFlightSchema.parse(flightInput(model.form[0])),
        id: model.form[0].id
          ? foundationUuidSchema.parse(model.form[0].id)
          : Crypto.randomUUID(),
        source: 'user-confirmed',
      })
    : model.editor[0] === 'plan'
      ? applyTrailPlan(journey, {
          ...trailPlanSchema.parse(model.form[0]),
          id: model.form[0].id
            ? foundationUuidSchema.parse(model.form[0].id)
            : Crypto.randomUUID(),
        })
      : applyTrailReceipt(journey, {
          ...trailReceiptSchema.parse(model.form[0]),
          id: Crypto.randomUUID(),
          attachment: requiredAttachment(model),
          createdAt: new Date().toISOString(),
        });
}

// 공항 현지 날짜·시각 입력을 저장용 시각으로 변환한다.
function flightInput(form: TrailForm): TrailForm {
  return {
    ...form,
    departureAt: `${form.departureDate}T${form.departureTime}:00${form.departureOffset}`,
    arrivalAt: `${form.arrivalDate}T${form.arrivalTime}:00${form.arrivalOffset}`,
  };
}

// 기존 항공 시각을 읽기 쉬운 수정 필드로 나눈다.
export function flightForm(flight: TrailJourney['flights'][number]): TrailForm {
  // 출발·도착 공항의 오프셋을 서로 독립적으로 유지한다.
  return {
    ...flight,
    searchDate: flight.departureAt.slice(0, 10),
    departureDate: flight.departureAt.slice(0, 10),
    departureTime: flight.departureAt.slice(11, 16),
    departureOffset: flight.departureAt.slice(-6),
    arrivalDate: flight.arrivalAt.slice(0, 10),
    arrivalTime: flight.arrivalAt.slice(11, 16),
    arrivalOffset: flight.arrivalAt.slice(-6),
  };
}

// 영수증은 원본 첨부 없이 등록하지 않는다.
function requiredAttachment(model: TrailModel): TrailReceipt['attachment'] {
  const attachment = model.attachment[0];
  if (!attachment)
    throw new UserFacingError('영수증 원본 사진 또는 PDF를 선택해 주세요.');
  return attachment;
}

// 저장 후 해당 콘텐츠를 선택한다.
function savedEditor(model: TrailModel): void {
  if (!model.editorSession.current.active) return;
  model.editorSession.current.revision += 1;
  // 새 여행은 방금 저장된 마지막 레코드를 선택한다.
  model.active[1](useTrailStore.getState().journeys.at(-1)?.id ?? '');
  model.editor[1](null);
  model.notice[1]('이 기기에 저장했습니다.');
}

// 영수증 없는 일정 하나를 제거한다.
export function deletePlan(
  model: TrailModel,
  journey: TrailJourney,
  planId: string,
): void {
  return runAction(model, () => {
    return saveTrailJourney(model.scope, removeTrailPlan(journey, planId));
  });
}

// 영수증 등록 하나를 콘텐츠에서 제거한다.
export function deleteReceipt(
  model: TrailModel,
  journey: TrailJourney,
  receiptId: string,
): void {
  return runAction(model, () => {
    return saveTrailJourney(model.scope, {
      ...journey,
      receipts: journey.receipts.filter((receipt) => {
        return receipt.id !== receiptId;
      }),
    }).then(() => {
      // 저장된 연결을 제거한 뒤 참조 없는 원본을 정리한다.
      return cleanupTrailAttachment(
        journey.receipts.find((receipt) => {
          return receipt.id === receiptId;
        })?.attachment ?? null,
        attachmentReferences(),
      );
    });
  });
}

// 사용자 행동의 동기·비동기 오류를 하나의 흐름으로 처리한다.
function runAction(model: TrailModel, action: () => unknown): void {
  const revision = model.editorSession.current.revision;
  void Promise.resolve()
    .then(action)
    .catch((error: unknown) => {
      if (
        !model.editorSession.current.active ||
        model.editorSession.current.revision !== revision
      )
        return;
      return model.notice[1](
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => {
                return `${issue.path.join('.') || '입력'}: ${issue.message}`;
              })
              .join('\n')
          : userFacingMessage(
              error,
              '작업을 다시 확인하고 다시 시도해 주세요.',
            ),
      );
    });
}
