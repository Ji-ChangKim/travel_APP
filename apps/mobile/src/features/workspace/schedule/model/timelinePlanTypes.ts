// 3가지 계획(나의 계획, 발자국 계획, 추천 계획) 화면의 통합 데이터 계약을 정의한다.
export type TimelinePlanMode = 'my' | 'footprint' | 'curated';

// 타임라인 단일 방문 및 이동 스케줄 항목 규격이다.
export interface TimelineScheduleItem {
  id: string;
  sortOrder: number;
  type: 'TRANSPORT' | 'PLACE' | 'STAY' | 'RESERVATION' | 'TODO' | 'MEMO';
  title: string;
  timeSlot?: string | null;
  address?: string;
  memo?: string | null;
  planContent?: import('@wherego/domain').WorkspaceSchedule['planContent'];
  googlePlaceId?: string;
  photoUrl?: string | null;
  badgeLabel?: string;
  transitInfo?: string;
  costInfo?: { currency: string; amount: string; note?: string };
  durationMinutes?: number | null;
  statusNote?: string;
  flightInfo?: {
    carrier: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    durationText?: string;
    statusText?: string;
  };
}

// 일차별 DAY 묶음 데이터 규격이다.
export interface TimelineDayGroup {
  city?: string;
  travelLegs?: import('@wherego/domain').CommunityPost['snapshot']['travelLegs'];
  id: string;
  dayNumber: number;
  dateText?: string;
  tabLabel: string;
  planTitle: string;
  planConcept: string;
  schedules: TimelineScheduleItem[];
  routeSummary?: {
    placeCount: number;
    distanceKm?: number;
    durationText?: string;
    routePathText: string;
    mapImageUrl?: string;
  };
}

// 화면 렌더러가 소비하는 통합 계획 데이터 모델이다.
export interface TimelinePlanModel {
  revision?: number | string;
  id: string;
  mode: TimelinePlanMode;
  title: string;
  country: string;
  city: string;
  periodText: string;
  badgeStepText: string;
  badgeDurationText: string;
  guideDescription: string;
  authorName?: string;
  authorAvatarUrl?: string;
  tipsTitle?: string;
  tipsDescription?: string;
  executionCtaLabel: string;
  days: TimelineDayGroup[];
}
