import { create } from 'zustand';

import type {
  ChecklistItem,
  Expense,
  ItineraryItem,
  Trip,
  TripMember,
  TripStatus,
  Visit,
} from '@wherego/domain';

// 일차 계산 결과 데이터 구조를 정의한다.
export interface CalculatedDay {
  dayNumber: number;
  dateString: string;
  dayLabel: string;
  weekday: string;
}

// 시작일과 종료일 사이의 날짜 목록(DAY 1~N)을 계산하는 순수 함수를 정의한다.
export function calculateTripDays(
  startDate: string,
  endDate: string,
): CalculatedDay[] {
  // 날짜 범위를 배열로 계산하여 DAY 1부터 DAY N까지 생성하고 반환한다.
  return Array.from(
    {
      length:
        Math.max(
          0,
          Math.floor(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        ) + 1,
    },
    (_, index) => {
      // 해당 일차의 밀리초 타임스탬프를 계산하여 Date 객체를 생성한다.
      const targetDate = new Date(
        new Date(startDate).getTime() + index * 24 * 60 * 60 * 1000,
      );
      // 날짜 문자열 YYYY-MM-DD를 추출한다.
      const dateString = targetDate.toISOString().split('T')[0] || '';
      // 요일 한국어 명칭 배열을 정의한다.
      const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
      // 일차 계산 결과 객체를 반환한다.
      return {
        dayNumber: index + 1,
        dateString,
        dayLabel: `DAY ${index + 1}`,
        weekday: weekdayNames[targetDate.getDay()] || '',
      };
    },
  );
}

// 초기 데모 여행 목록을 정의한다.
const initialDemoTrips: Trip[] = [
  {
    id: 'trip-demo-1',
    userId: 'user-me',
    title: '제주 푸른 바다 힐링 여행',
    country: '대한민국',
    city: '제주',
    startDate: '2026-10-15',
    endDate: '2026-10-18',
    status: 'PLANNED',
    coverColor: '#246A54',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'trip-demo-2',
    userId: 'user-me',
    title: '도쿄 골목 미식 산책',
    country: '일본',
    city: '도쿄',
    startDate: '2026-09-20',
    endDate: '2026-09-25',
    status: 'IN_PROGRESS',
    coverColor: '#1565C0',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'trip-demo-3',
    userId: 'user-me',
    title: '강릉 바다와 커피 로드',
    country: '대한민국',
    city: '강릉',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    status: 'COMPLETED',
    coverColor: '#E65100',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
  },
];

// 초기 데모 세부 일정 데이터를 정의한다.
const initialDemoItineraries: Record<string, ItineraryItem[]> = {
  'trip-demo-1': [
    {
      id: 'itin-1',
      tripDayId: 'day-1',
      placeId: 'p-1',
      type: 'PLACE',
      title: '제주국제공항',
      timeSlot: '11:00',
      sortOrder: 1,
      estimatedCost: 0,
      memo: '렌터카 인수 후 바로 출발',
      createdAt: '2026-09-01',
      place: {
        id: 'p-1',
        name: '제주국제공항',
        address: '제주특별자치도 제주시 공항로 2',
        latitude: 33.5066,
        longitude: 126.493,
        category: 'activity',
        createdAt: '2026-09-01',
      },
    },
    {
      id: 'itin-2',
      tripDayId: 'day-1',
      placeId: 'p-2',
      type: 'PLACE',
      title: '함덕 해수욕장',
      timeSlot: '14:00',
      sortOrder: 2,
      estimatedCost: 15000,
      memo: '에메랄드빛 바다 배경 사진 촬영 & 카페 음료',
      createdAt: '2026-09-01',
      place: {
        id: 'p-2',
        name: '함덕 해수욕장',
        address: '제주특별자치도 제주시 조천읍 조함해안로 525',
        latitude: 33.5434,
        longitude: 126.6692,
        category: 'sightseeing',
        createdAt: '2026-09-01',
      },
    },
    {
      id: 'itin-3',
      tripDayId: 'day-2',
      placeId: 'p-3',
      type: 'PLACE',
      title: '성산일출봉',
      timeSlot: '09:00',
      sortOrder: 1,
      estimatedCost: 5000,
      memo: '왕복 50분 코스 등반',
      createdAt: '2026-09-01',
      place: {
        id: 'p-3',
        name: '성산일출봉',
        address: '제주특별자치도 서귀포시 성산읍 일출로 284-12',
        latitude: 33.4586,
        longitude: 126.9427,
        category: 'sightseeing',
        createdAt: '2026-09-01',
      },
    },
  ],
  'trip-demo-2': [
    {
      id: 'itin-4',
      tripDayId: 'day-1',
      placeId: 'p-4',
      type: 'PLACE',
      title: '시부야 미식 골목',
      timeSlot: '12:30',
      sortOrder: 1,
      estimatedCost: 20000,
      memo: '현지인 추천 라멘 전문점',
      createdAt: '2026-09-01',
      place: {
        id: 'p-4',
        name: '시부야 미식 골목',
        address: '도쿄도 시부야구',
        latitude: 35.658,
        longitude: 139.7016,
        category: 'food',
        createdAt: '2026-09-01',
      },
    },
  ],
};

// 초기 데모 비용 내역(예상 및 실제 지출)을 정의한다.
const initialDemoExpenses: Record<string, Expense[]> = {
  'trip-demo-1': [
    {
      id: 'exp-1',
      tripId: 'trip-demo-1',
      tripDayId: 'day-1',
      scheduleId: 'itin-2',
      title: '함덕 오션뷰 카페 음료 2잔',
      amount: 16000,
      currency: 'KRW',
      category: 'food',
      isActual: true,
      paidByUserId: 'user-me',
      createdAt: '2026-09-01',
    },
    {
      id: 'exp-2',
      tripId: 'trip-demo-1',
      tripDayId: 'day-1',
      title: '제주 렌터카 주유비 (예상)',
      amount: 50000,
      currency: 'KRW',
      category: 'transport',
      isActual: false,
      paidByUserId: 'user-me',
      createdAt: '2026-09-01',
    },
    {
      id: 'exp-3',
      tripId: 'trip-demo-1',
      tripDayId: 'day-2',
      scheduleId: 'itin-3',
      title: '성산일출봉 입장료 (2인)',
      amount: 10000,
      currency: 'KRW',
      category: 'activity',
      isActual: false,
      paidByUserId: 'user-me',
      createdAt: '2026-09-01',
    },
  ],
};

// 초기 데모 준비물 체크리스트를 정의한다.
const initialDemoChecklists: Record<string, ChecklistItem[]> = {
  'trip-demo-1': [
    {
      id: 'chk-1',
      tripId: 'trip-demo-1',
      title: '신분증 및 운전면허증 지참',
      isCompleted: true,
      createdAt: '2026-09-01',
    },
    {
      id: 'chk-2',
      tripId: 'trip-demo-1',
      title: '카메라 및 보조배터리 충전',
      isCompleted: false,
      createdAt: '2026-09-01',
    },
    {
      id: 'chk-3',
      tripId: 'trip-demo-1',
      title: '선글라스 & 자외선 차단제',
      isCompleted: false,
      createdAt: '2026-09-01',
    },
  ],
};

// 초기 데모 참여 멤버를 정의한다.
const initialDemoMembers: Record<string, TripMember[]> = {
  'trip-demo-1': [
    {
      id: 'mem-1',
      tripId: 'trip-demo-1',
      userId: 'user-me',
      role: 'owner',
      joinedAt: '2026-09-01',
    },
    {
      id: 'mem-2',
      tripId: 'trip-demo-1',
      userId: 'user-friend1',
      role: 'editor',
      joinedAt: '2026-09-02',
    },
  ],
};

// 초기 데모 방문 발자국 데이터를 정의한다.
const initialDemoVisits: Visit[] = [
  {
    id: 'visit-1',
    tripId: 'trip-demo-3',
    placeId: 'p-101',
    userId: 'user-me',
    visitedAt: '2026-08-11T14:30:00Z',
    latitude: 37.7718,
    longitude: 128.9482,
    verification: 'gps',
    isVerified: true,
    createdAt: '2026-08-11T14:30:00Z',
    place: {
      id: 'p-101',
      name: '안목해변 커피거리',
      address: '강원특별자치도 강릉시 창해로 14번길',
      category: 'cafe',
      createdAt: '2026-08-11',
    },
  },
];

interface TripState {
  trips: Trip[];
  selectedTripId: string;
  itineraries: Record<string, ItineraryItem[]>;
  expenses: Record<string, Expense[]>;
  checklists: Record<string, ChecklistItem[]>;
  members: Record<string, TripMember[]>;
  shareTokens: Record<string, string>;
  visits: Visit[];

  setSelectedTripId: (id: string) => void;
  createTrip: (
    newTrip: Omit<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ) => Trip;
  updateTripStatus: (tripId: string, status: TripStatus) => void;
  addItineraryItem: (
    tripId: string,
    item: Omit<ItineraryItem, 'id' | 'createdAt'>,
  ) => void;
  reorderItinerary: (tripId: string, itemIds: string[]) => void;
  addExpense: (
    tripId: string,
    expense: Omit<Expense, 'id' | 'tripId' | 'createdAt'>,
  ) => void;
  toggleChecklistItem: (tripId: string, itemId: string) => void;
  addChecklistItem: (tripId: string, title: string) => void;
  generateShareToken: (tripId: string) => string;
  checkInPlace: (
    tripId: string,
    item: ItineraryItem,
    method?: Visit['verification'],
  ) => void;
}

// 여행, 일정, 비용, 체크리스트를 통합 관리하는 Zustand 전역 스토어를 생성한다.
export const useTripStore = create<TripState>((set) => ({
  trips: initialDemoTrips,
  selectedTripId: initialDemoTrips[0]?.id || '',
  itineraries: initialDemoItineraries,
  expenses: initialDemoExpenses,
  checklists: initialDemoChecklists,
  members: initialDemoMembers,
  shareTokens: { 'trip-demo-1': 'token-wherego-demo-jeju-2026' },
  visits: initialDemoVisits,

  // 현재 선택된 활성 여행 아이디를 변경한다.
  setSelectedTripId: (id: string) => {
    // 상태의 selectedTripId를 전달받은 id 값으로 갱신한다.
    set({ selectedTripId: id });
  },

  // 새로운 여행을 생성하여 목록 맨 앞에 추가한다.
  createTrip: (newTripData) => {
    // 고유 식별자와 생성 시각을 부여하여 새 여행 인스턴스를 생성한다.
    const createdTrip: Trip = {
      ...newTripData,
      id: `trip-${Date.now()}`,
      userId: 'user-me',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // 상태에 새 여행을 추가하고 연관된 빈 데이터 컬렉션을 초기화한다.
    set((state) => ({
      trips: [createdTrip, ...state.trips],
      selectedTripId: createdTrip.id,
      itineraries: { ...state.itineraries, [createdTrip.id]: [] },
      expenses: { ...state.expenses, [createdTrip.id]: [] },
      checklists: { ...state.checklists, [createdTrip.id]: [] },
      members: {
        ...state.members,
        [createdTrip.id]: [
          {
            id: `mem-${Date.now()}`,
            tripId: createdTrip.id,
            userId: 'user-me',
            role: 'owner',
            joinedAt: new Date().toISOString(),
          },
        ],
      },
    }));
    // 생성된 새 여행 객체를 반환한다.
    return createdTrip;
  },

  // 특정 여행의 진행 상태(예정/여행 중/완료)를 변경한다.
  updateTripStatus: (tripId: string, status: TripStatus) => {
    // 대상 여행의 status 속성을 새 상태로 매핑하여 갱신한다.
    set((state) => ({
      trips: state.trips.map((t) => (t.id === tripId ? { ...t, status } : t)),
    }));
  },

  // 특정 여행에 새로운 일정 아이템을 추가한다.
  addItineraryItem: (tripId: string, itemData) => {
    // 신규 일정 객체를 생성하고 생성 시각을 기록한다.
    const newItem: ItineraryItem = {
      ...itemData,
      id: `itin-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    // 해당 여행의 일정 목록 뒤에 새 일정을 덧붙여 상태를 갱신한다.
    set((state) => {
      // 기존 일정 목록을 안전하게 가져온다.
      const current = state.itineraries[tripId] || [];
      // 기존 목록과 새 아이템을 결합하여 저장한다.
      return {
        itineraries: {
          ...state.itineraries,
          [tripId]: [...current, newItem],
        },
      };
    });
  },

  // 일정 목록의 순서(sort_order)를 재정렬한다.
  reorderItinerary: (tripId: string, itemIds: string[]) => {
    // 순서 배열에 맞추어 sortOrder 번호를 1부터 다시 부여한다.
    set((state) => {
      // 대상 여행의 일정 목록을 가져온다.
      const current = state.itineraries[tripId] || [];
      // ID 순서에 맞추어 재정렬된 새 배열을 구성한다.
      const reordered = itemIds
        .map((id, idx) => {
          // 해당 ID를 가진 일정을 찾는다.
          const found = current.find((item) => item.id === id);
          // sortOrder를 새로운 인덱스 + 1로 갱신하여 반환한다.
          return found ? { ...found, sortOrder: idx + 1 } : null;
        })
        .filter((item): item is ItineraryItem => item !== null);

      // 갱신된 재정렬 일정을 반환한다.
      return {
        itineraries: {
          ...state.itineraries,
          [tripId]: reordered,
        },
      };
    });
  },

  // 특정 여행에 가계부 지출 항목(예상 또는 실제)을 등록한다.
  addExpense: (tripId: string, expenseData) => {
    // 신규 비용 객체를 생성한다.
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      tripId,
      createdAt: new Date().toISOString(),
    };
    // 해당 여행의 지출 목록 맨 앞에 추가한다.
    set((state) => {
      // 기존 비용 목록을 가져온다.
      const current = state.expenses[tripId] || [];
      // 새 비용 항목을 결합하여 저장한다.
      return {
        expenses: {
          ...state.expenses,
          [tripId]: [newExpense, ...current],
        },
      };
    });
  },

  // 체크리스트 준비물의 완료 여부를 반전(토글)한다.
  toggleChecklistItem: (tripId: string, itemId: string) => {
    // 대상 항목의 isCompleted 플래그를 반전시킨다.
    set((state) => {
      // 기존 체크리스트 목록을 가져온다.
      const current = state.checklists[tripId] || [];
      // 완료 여부를 토글한 새 목록을 생성한다.
      const updated = current.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item,
      );
      // 갱신된 체크리스트를 상태에 반영한다.
      return {
        checklists: {
          ...state.checklists,
          [tripId]: updated,
        },
      };
    });
  },

  // 체크리스트에 새로운 준비물을 추가한다.
  addChecklistItem: (tripId: string, title: string) => {
    // 새 체크리스트 아이템을 생성한다.
    const newItem: ChecklistItem = {
      id: `chk-${Date.now()}`,
      tripId,
      title,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    // 해당 여행의 체크리스트에 추가한다.
    set((state) => {
      // 기존 목록을 가져온다.
      const current = state.checklists[tripId] || [];
      // 새 항목을 추가하여 반환한다.
      return {
        checklists: {
          ...state.checklists,
          [tripId]: [...current, newItem],
        },
      };
    });
  },

  // 여행 공유를 위한 고유 초대 토큰을 생성하거나 반환한다.
  generateShareToken: (tripId: string) => {
    // 16자리 랜덤 문자열로 초대 토큰을 생성한다.
    const newToken = `wherego-${tripId}-${Math.random().toString(36).substring(2, 10)}`;
    // 발급된 토큰을 스토어에 기록한다.
    set((state) => ({
      shareTokens: {
        ...state.shareTokens,
        [tripId]: newToken,
      },
    }));
    // 생성된 토큰 문자열을 반환한다.
    return newToken;
  },

  // 예정된 일정 장소를 실제 방문 발자국(visits)으로 전환한다.
  checkInPlace: (tripId: string, item: ItineraryItem, method = 'gps') => {
    // 방문 인증 기록 객체를 생성한다.
    const newVisit: Visit = {
      id: `visit-${Date.now()}`,
      tripId,
      placeId: item.placeId,
      userId: 'user-me',
      visitedAt: new Date().toISOString(),
      latitude: item.place?.latitude || 33.5,
      longitude: item.place?.longitude || 126.5,
      verification: method,
      isVerified: true,
      createdAt: new Date().toISOString(),
      place: item.place,
    };
    // 발자국 목록에 추가한다.
    set((state) => ({
      visits: [newVisit, ...state.visits],
    }));
  },
}));
