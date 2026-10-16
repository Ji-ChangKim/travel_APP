import type {
  FlightDetails,
  PersistedTrip,
  MemberRole,
  SupportedCurrency,
  ScheduleType,
} from './index';

// 앱과 향후 웹이 같은 서버 스냅샷 계약을 사용한다.
export interface SchedulePlanContent {
  description: string;
  choiceGroup?: string;
  choiceLabel?: string;
  choiceKind?: 'choice' | 'backup';
}
export interface WorkspaceDay {
  id: string;
  dayNumber: number;
  tripDate: string;
  planTitle?: string;
  planConcept?: string;
}
export interface WorkspaceSchedule {
  id: string;
  dayId: string;
  title: string;
  type: ScheduleType;
  timeSlot: string | null;
  sortOrder: number;
  memo: string | null;
  address: string;
  googlePlaceId?: string;
  // 사용자가 지도에서 선택한 실제 위치만 선택적으로 보관한다.
  location?: { latitude: number; longitude: number } | null;
  // 생략은 이전 앱의 기록이며 null은 사용자가 항공편 연결을 해제한 상태다.
  flight?: FlightDetails | null;
  // 사용자가 정한 방문 체류시간이며 생략은 이전 기록, null은 미정이다.
  durationMinutes?: number | null;
  // 사용자가 공유용으로 따로 입력한 계획이며 개인 메모와 분리한다.
  planContent?: SchedulePlanContent | null;
}
export interface WorkspaceMedia {
  id: string;
  path: string;
  purpose: 'photo' | 'receipt';
  scheduleId: string | null;
}
export interface WorkspaceExpense {
  id: string;
  dayId: string | null;
  scheduleId: string | null;
  title: string;
  amount: string;
  currency: SupportedCurrency;
  isActual: boolean;
  category: string;
  source: string;
}
export interface WorkspaceReceipt {
  id: string;
  scheduleId: string;
  mediaId: string;
  // 원본 식별자는 유지하며 사진을 실제 보관했는지는 별도로 표시한다.
  keepPhoto?: boolean;
  merchant: string;
  date: string;
  amount: string;
  currency: SupportedCurrency;
  details: string;
  address?: string;
  transactionTime?: string;
  items?: ReceiptItem[];
  category?: ReceiptCategory;
}
export interface WorkspaceSnapshot {
  trip: PersistedTrip;
  myRole: MemberRole;
  days: WorkspaceDay[];
  itinerary: WorkspaceSchedule[];
  expenses: WorkspaceExpense[];
  checklists: { id: string; title: string; isCompleted: boolean }[];
  members: {
    memberId: string;
    userId: string;
    nickname: string;
    role: MemberRole;
    isMe: boolean;
  }[];
  media: WorkspaceMedia[];
  receipts: WorkspaceReceipt[];
  invites: {
    id: string;
    role: MemberRole;
    expiresAt: string;
    revokedAt: string | null;
    usedAt: string | null;
  }[];
  postId: string | null;
}
export interface CommunityPost {
  kind?: 'plan' | 'record';
  id: string;
  authorId: string;
  author: string;
  title: string;
  body: string;
  publishedAt: string;
  photoPaths: string[];
  snapshot: {
    days?: {
      dayNumber: number;
      date: string;
      planTitle?: string;
      planConcept?: string;
    }[];
    country: string;
    city: string;
    startDate: string;
    endDate: string;
    itinerary: {
      id?: string;
      dayNumber?: number;
      sortOrder?: number;
      type?: ScheduleType;
      googlePlaceId?: string;
      planContent?: SchedulePlanContent | null;
      title: string;
      date: string;
      timeSlot: string | null;
      address: string;
    }[];
    costs: Partial<Record<SupportedCurrency, string>>;
  };
}
export interface ReceiptDraft {
  rawText: string;
  merchant: string;
  transactionDate: string;
  amount: string;
  currency: string;
  needsConfirmation: true;
  address: string;
  transactionTime: string;
  items: ReceiptItem[];
  category: ReceiptCategory;
  warnings: string[];
}

// 읽지 못한 단가·수량은 빈 값으로 두고 메뉴 원문을 보존한다.
export interface ReceiptItem {
  name: string;
  quantity: number | null;
  unitPrice: string;
  amount: string;
}
export type ReceiptCategory =
  'food' | 'transport' | 'stay' | 'activity' | 'shopping' | 'etc';
