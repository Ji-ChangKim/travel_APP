import type { TripStatus } from './index';

// M1 서버 계약을 기존 모바일 메모리 객체와 분리해 단계적으로 이행한다.
export type SupportedCurrency = 'KRW' | 'JPY' | 'USD';

// API 금액은 정밀도를 보존하는 십진 문자열을 사용한다.
export type DecimalAmount = string;

// 서버 여행 생성의 입력 필드를 정의한다.
export interface PersistedTripInput {
  title?: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  timezone: string;
  defaultCurrency?: SupportedCurrency;
  coverColor?: string;
}

// 서버가 확정한 여행과 집계 버전을 정의한다.
export interface PersistedTrip extends PersistedTripInput {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  defaultCurrency: SupportedCurrency;
  coverColor: string;
  status: TripStatus;
}

// 멱등 저장 결과의 서버 메타데이터를 정의한다.
export interface MutationResult<T> {
  data: T;
  replayed: boolean;
}

// 공개 오류 계약에 내부 SQL과 인증 정보를 포함하지 않는다.
export interface FoundationApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
