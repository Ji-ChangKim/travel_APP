import type {
  PersistedTrip,
  MemberRole,
  SupportedCurrency,
  ScheduleType,
} from './index';

// 앱과 향후 웹이 같은 서버 스냅샷 계약을 사용한다.
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
  merchant: string;
  date: string;
  amount: string;
  currency: SupportedCurrency;
  details: string;
}
export interface WorkspaceSnapshot {
  trip: PersistedTrip;
  myRole: MemberRole;
  days: { id: string; dayNumber: number; tripDate: string }[];
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
  id: string;
  authorId: string;
  author: string;
  title: string;
  body: string;
  publishedAt: string;
  photoPaths: string[];
  snapshot: {
    country: string;
    city: string;
    startDate: string;
    endDate: string;
    itinerary: {
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
  currency: SupportedCurrency;
  needsConfirmation: true;
}
