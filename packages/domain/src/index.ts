// 여행 진행 상태를 구분한다.
export type TripStatus =
  | 'DRAFT' // 작성 중
  | 'PLANNED' // 여행 예정
  | 'IN_PROGRESS' // 여행 중
  | 'COMPLETED' // 여행 완료 (발자국 전환 대상)
  | 'ARCHIVED'; // 보관됨

// 장소의 유형 및 성격을 구분한다.
export type PlaceCategory =
  | 'stay' // 숙소
  | 'food' // 식당
  | 'cafe' // 카페
  | 'sightseeing' // 관광지/명소
  | 'activity' // 액티비티/체험
  | 'etc'; // 기타

// 여행 동행자의 접근 및 편집 권한을 정의한다.
export type MemberRole = 'owner' | 'editor' | 'viewer';

// 방문 인증 수단을 구분한다.
export type VerificationMethod = 'gps' | 'manual' | 'receipt';

// 사용자 기본 프로필 정보를 정의한다.
export interface Profile {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 장소 마스터 정보를 정의한다.
export interface Place {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category: PlaceCategory;
  phone?: string | null;
  createdAt: string;
}

// 여행 마스터 정보(국가, 도시, 기간, 상태 등)를 정의한다.
export interface Trip {
  id: string;
  userId: string;
  title: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
}

// 여행의 동행 멤버 정보를 정의한다.
export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

// 특정 일차의 날짜 정보를 정의한다.
export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  tripDate: string;
  createdAt: string;
}

// 일정의 성격을 구분한다 (장소, 이동, 숙소, 예약, 할일, 메모).
export type ScheduleType =
  'PLACE' | 'TRANSPORT' | 'STAY' | 'RESERVATION' | 'TODO' | 'MEMO';

// 갈 예정인 장소의 세부 일정을 정의한다.
export interface ItineraryItem {
  id: string;
  tripDayId: string;
  placeId: string;
  type?: ScheduleType;
  title?: string;
  timeSlot?: string | null;
  sortOrder: number;
  estimatedCost?: number | null;
  actualCost?: number | null;
  memo?: string | null;
  createdAt: string;
  place?: Place;
}

// 여행 경비(예상/실제) 및 지출 내역을 정의한다.
export interface Expense {
  id: string;
  tripId: string;
  tripDayId?: string | null;
  scheduleId?: string | null;
  title: string;
  amount: number;
  currency: string;
  category: 'food' | 'transport' | 'stay' | 'activity' | 'shopping' | 'etc';
  isActual: boolean; // false: 예상 비용, true: 실제 지출
  paidByUserId?: string | null;
  createdAt: string;
}

// 여행 준비물 및 체크리스트 항목을 정의한다.
export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  isCompleted: boolean;
  assignedUserId?: string | null;
  createdAt: string;
}

// 실제로 방문한 장소(체크인/발자국)를 정의한다.
export interface Visit {
  id: string;
  tripId: string;
  placeId: string;
  userId: string;
  visitedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  verification: VerificationMethod;
  isVerified: boolean;
  createdAt: string;
  place?: Place;
}

// 방문 장소에 남긴 후기 및 별점 리뷰를 정의한다.
export interface Review {
  id: string;
  visitId: string;
  userId: string;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 영수증 OCR 분석 및 결제 내역을 정의한다.
export interface Receipt {
  id: string;
  visitId?: string | null;
  userId: string;
  merchantName?: string | null;
  transactionDate?: string | null;
  totalAmount?: number | null;
  ocrRawText?: string | null;
  createdAt: string;
}

// 여행 공유를 위한 읽기 전용 링크 정보를 정의한다.
export interface ShareLink {
  id: string;
  tripId: string;
  token: string;
  expiresAt?: string | null;
  permissions: 'read_only';
  createdAt: string;
}
