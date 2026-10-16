import { z } from 'zod';
import { scheduleLocationSchema } from '@wherego/validation';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { tripPeriodImpact, periodBlockedMessage } from './tripPeriod';
import { countryInputError } from './countries';

export type FieldErrors = Record<string, string>;
export type FormFeedbackState = { fields: FieldErrors; attempt: number };

export const formFieldLabels: Record<string, string> = {
  title: '제목',
  country: '나라',
  city: '도시',
  startDate: '시작일',
  endDate: '종료일',
  timezone: '현지 시간대',
  defaultCurrency: '기본 통화',
  dayId: '여행 날짜',
  timeSlot: '일정 시간 (HH:mm)',
  sortOrder: '일정 순서',
  memo: '일정 메모',
  address: '지역명·주소',
  durationMinutes: '체류 예정 시간 (분)',
  amount: '금액',
  currency: '금액',
  estimatedCost: '예상 지출 금액',
  estimatedAmount: '예상 지출 금액',
  estimatedCurrency: '예상 지출 금액',
  mapLocation: '지도 위치',
  location: '지도 위치',
  merchant: '영수증 상호',
  transactionDate: '실제 결제 날짜',
  transactionTime: '실제 결제 시간',
  details: '구매 내역',
  body: '커뮤니티 본문',
  planTitle: '이날 계획 제목',
  planConcept: '이날 여행 컨셉',
  description: '계획 설명·추천 메뉴·팁',
  choiceGroup: '같은 선택지 묶음',
  choiceLabel: '선택지 안내',
  flightNumber: '항공 편명 (예: KE123)',
  number: '항공 편명 (예: KE123)',
  flightDeparture: '출발 공항 코드',
  departure: '출발 공항 코드',
  flightArrival: '도착 공항 코드',
  arrival: '도착 공항 코드',
  flightTime: '출발 시각 (선택, HH:mm)',
  time: '출발 시각 (선택, HH:mm)',
  arrivalDate: '도착일 (현지, YYYY-MM-DD, 선택)',
  arrivalTime: '도착 시각 (현지, HH:mm, 선택)',
  departureTerminal: '출발 터미널 (선택)',
  arrivalTerminal: '도착 터미널 (선택)',
  baggageKg: '무료 위탁수하물 (kg, 선택)',
  cabin: '좌석 등급 (선택)',
  aircraftType: '항공기 기종 (선택)',
  aircraftRegistration: '항공기 등록번호 (선택)',
};

const issueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  maximum: z.number().optional(),
  type: z.string().optional(),
  minimum: z.number().optional(),
  message: z.string(),
});
const failureSchema = z.object({ issues: z.array(issueSchema) });

// 공통 저장 스키마의 오류 경로를 사용자가 보는 입력란으로 연결한다.
export function formFailureFields(failure: unknown, kind: string): FieldErrors {
  // 원본 서버 오류나 영문 스키마 메시지를 화면에 그대로 노출하지 않는다.
  return failureFields(failureSchema.safeParse(failure), kind);
}

// 검증에 성공한 오류 목록만 필드 안내로 바꾼다.
function failureFields(
  result: ReturnType<typeof failureSchema.safeParse>,
  kind: string,
): FieldErrors {
  // 같은 필드의 여러 오류 중 첫 안내만 유지한다.
  return result.success
    ? result.data.issues.reduce((fields, issue) => {
        // 서버 계약의 input·flight 같은 객체 경로를 실제 입력 이름으로 해석한다.
        return addIssue(fields, issue, kind);
      }, {} as FieldErrors)
    : {};
}

// 한 오류를 이미 수집한 안내에 추가한다.
function addIssue(
  fields: FieldErrors,
  issue: z.infer<typeof issueSchema>,
  kind: string,
): FieldErrors {
  // 금액의 객체 전체 검사와 항공편 세부 필드 경로를 함께 처리한다.
  return addFieldError(fields, issueLabel(issue.path, kind), issue);
}

// 오류 경로에서 화면의 입력 이름을 찾는다.
function issueLabel(path: (string | number)[], kind: string): string {
  // 예상 비용의 소수 검사 실패도 해당 금액 입력으로 이동한다.
  return kind === 'trip' && path.at(-1) === 'title'
    ? '나의 여행 주제'
    : path.includes('estimatedCost')
      ? '예상 지출 금액'
      : typeof path[0] === 'number' && kind === 'receipt'
        ? receiptItemLabel(['items', ...path])
        : path.includes('items')
          ? receiptItemLabel(path)
          : path.includes('location')
            ? formFieldLabels.location!
            : (path.includes('flight') || path.length === 1) &&
                path.at(-1) === 'durationMinutes'
              ? '소요시간 (분, 선택)'
              : formFieldLabels[String(path.at(-1))] ||
                (kind === 'expense' || kind === 'receipt' ? '금액' : '제목');
}

// 영수증 품목 오류를 해당 행의 입력 이름으로 연결한다.
function receiptItemLabel(path: (string | number)[]): string {
  // 인식한 품목의 순번과 저장 계약의 필드를 그대로 사용한다.
  return `${Number(path[path.indexOf('items') + 1]) + 1}번 메뉴 ${receiptItemLabels[String(path.at(-1))] || '이름'}`;
}
const receiptItemLabels: Record<string, string> = {
  name: '이름',
  quantity: '수량',
  unitPrice: '단가',
  amount: '금액',
};

// 입력 종류와 제한값을 쉬운 안내 문구로 바꾼다.
function addFieldError(
  fields: FieldErrors,
  label: string,
  issue: z.infer<typeof issueSchema>,
): FieldErrors {
  // 입력을 자르지 않고 오류가 난 항목만 수정하도록 안내한다.
  return fields[label]
    ? fields
    : {
        ...fields,
        [label]:
          issue.code === 'too_big' && issue.maximum !== undefined
            ? `${label} 입력은 ${issue.maximum}${issue.type === 'string' ? '자' : ''} 이하로 입력해 주세요.`
            : issue.code === 'too_small' && issue.minimum === 1
              ? `${label} 항목을 입력해 주세요.`
              : /시간|시각/.test(label) && issue.code === 'invalid_string'
                ? '시간은 00:00~23:59의 HH:mm 형식으로 입력해 주세요.'
                : /[가-힣]/.test(issue.message)
                  ? issue.message
                  : `${label} 항목을 확인해 주세요.`,
      };
}

// 변환 전에 국가 정책과 좌표 JSON의 유효성을 검사한다.
export function formInputFields(
  kind: string,
  values: Record<string, string>,
  snapshot?: WorkspaceSnapshot,
): FieldErrors {
  // 자유 입력에도 선택 목록과 같은 정책을 적용한다.
  return {
    ...(kind === 'period' &&
    snapshot &&
    tripPeriodImpact(snapshot, values)?.blocked
      ? { 시작일: periodBlockedMessage }
      : {}),
    ...((kind === 'trip' || kind === 'metadata') &&
    countryInputError(values.country || '')
      ? { 나라: countryInputError(values.country || '') }
      : {}),
    ...(values.mapLocation && !validLocationText(values.mapLocation)
      ? {
          [formFieldLabels.location!]:
            '위도는 -90~90, 경도는 -180~180 범위로 함께 선택해 주세요.',
        }
      : {}),
  };
}

// 저장한 좌표 문자열을 공통 위치 계약으로 검사한다.
function validLocationText(text: string): boolean {
  // 파손된 좌표를 일반 통신 실패로 안내하지 않는다.
  try {
    return scheduleLocationSchema.safeParse(JSON.parse(text)).success;
  } catch {
    return false;
  }
}

// 입력 변경에서 해당 항목과 연관된 오류만 지운다.
export function revisedFormFeedback(
  previous: FormFeedbackState,
  key: string,
): FormFeedbackState {
  // 새로운 제출이 아니므로 초점 이동 순번은 유지한다.
  return {
    ...previous,
    fields: Object.fromEntries(
      Object.entries(previous.fields).filter(([label]) => {
        // 기간과 통화 변경은 서로 연관된 필드 안내를 함께 정리한다.
        return ![
          formFieldLabels[key],
          ...(key === 'title' ? ['나의 여행 주제'] : []),
          ...(key === 'country' ? ['도시'] : []),
          ...(key.startsWith('flight')
            ? Object.values(formFieldLabels).filter((value) =>
                /공항|항공|출발 시간|선택\)/.test(value),
              )
            : []),
          ...(['startDate', 'endDate'].includes(key)
            ? ['시작일', '종료일']
            : []),
        ].includes(label);
      }),
    ),
  };
}
