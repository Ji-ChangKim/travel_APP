import { create } from 'zustand';

import type {
  AuthProvider,
  ChecklistItem,
  Expense,
  ItineraryItem,
  OsPlatform,
  Profile,
  Trip,
  TripMember,
  TripStatus,
  Visit,
} from '@wherego/domain';

import {
  clearGuestSession,
  generateGuestProfile,
  loadStoredGuestSession,
  saveGuestSession,
} from '@/services/guestAuthService';
import { upsertSocialProfile } from '@/services/profileService';

// 일차 계산 결과 데이터 구조를 정의한다.
export interface CalculatedDay {
  dayNumber: number;
  dateString: string;
  dayLabel: string;
  weekday: string;
}

// 6자리 고유 여행 초대 코드를 생성한다.
export function generateInviteCode(): string {
  // 영문 대문자와 숫자를 조합한 6자리 코드를 반환한다.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 시작일과 종료일 사이의 날짜 목록(DAY 1~N)을 계산하는 순수 함수를 정의한다.
export function calculateTripDays(
  startDate: string,
  endDate: string,
): CalculatedDay[] {
  // 날짜 범위를 배열로 계산하여 DAY 1부터 DAY N까지 생성하고 반환한다.
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const dayCount = Math.max(
    1,
    Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1,
  );

  return Array.from({ length: dayCount }, (_, index) => {
    // 해당 일차의 밀리초 타임스탬프를 계산하여 Date 객체를 생성한다.
    const targetDate = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
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
  });
}

// 여행 스토어 상태 및 조작 액션 인터페이스를 정의한다.
interface TripState {
  // 현재 로그인한 사용자 프로필
  currentUser: Profile | null;
  // 등록된 여행 목록 (예시 없이 빈 배열로 시작)
  trips: Trip[];
  // 현재 보고 있는 여행 식별자
  selectedTripId: string;
  // 여행별 일정 아이템 맵
  itineraries: Record<string, ItineraryItem[]>;
  // 여행별 비용 지출 맵
  expenses: Record<string, Expense[]>;
  // 여행별 준비물 체크리스트 맵
  checklists: Record<string, ChecklistItem[]>;
  // 여행별 참여 멤버 맵
  members: Record<string, TripMember[]>;
  // 여행별 고유 공유 토큰 맵
  shareTokens: Record<string, string>;
  // 방문 체크인 발자국 기록 목록
  visits: Visit[];

  // 사용자 로그인 처리
  login: (nickname: string) => Profile;
  // 소셜 로그인 처리 (구글/카카오/애플)
  loginWithSocial: (
    provider: AuthProvider,
    nickname: string,
    osPlatform: OsPlatform,
    avatarUrl?: string,
  ) => Promise<Profile>;
  // 게스트 둘러보기 로그인 처리 (기기 영구 저장)
  loginAsGuest: (osPlatform: OsPlatform) => Promise<Profile>;
  // 기기 저장소에 보관된 게스트 세션 복원
  initGuestSession: () => Promise<Profile | null>;
  // 사용자 프로필 직접 설정
  setCurrentUser: (profile: Profile | null) => void;
  // 사용자 프로필 정보 갱신
  updateProfile: (updates: Partial<Profile>) => void;
  // 사용자 로그아웃 처리
  logout: () => void;
  // 활성 여행 ID 설정
  setSelectedTripId: (id: string) => void;
  // 새 여행 생성
  createTrip: (
    newTrip: Omit<
      Trip,
      'id' | 'userId' | 'createdAt' | 'updatedAt' | 'inviteCode'
    >,
  ) => Trip;
  // 여행 삭제
  deleteTrip: (tripId: string) => void;
  // 초대 코드로 여행 참여
  joinTripByInviteCode: (inviteCode: string) => {
    success: boolean;
    message: string;
    trip?: Trip;
  };
  // 여행 진행 상태 갱신
  updateTripStatus: (tripId: string, status: TripStatus) => void;
  // 일정 추가
  addItineraryItem: (
    tripId: string,
    item: Omit<ItineraryItem, 'id' | 'createdAt'>,
  ) => ItineraryItem;
  // 일정 삭제
  deleteItineraryItem: (tripId: string, itemId: string) => void;
  // 일정 순서 재정렬
  reorderItinerary: (tripId: string, itemIds: string[]) => void;
  // 비용 추가
  addExpense: (
    tripId: string,
    expense: Omit<Expense, 'id' | 'tripId' | 'createdAt'>,
  ) => void;
  // 체크리스트 토글
  toggleChecklistItem: (tripId: string, itemId: string) => void;
  // 체크리스트 추가
  addChecklistItem: (tripId: string, title: string) => void;
  // 공유 토큰 발급
  generateShareToken: (tripId: string) => string;
  // 장소 체크인 (발자국 등록)
  checkInPlace: (
    tripId: string,
    item: ItineraryItem,
    method?: Visit['verification'],
  ) => void;
}

// 여행, 일정, 비용, 체크리스트를 통합 관리하는 Zustand 전역 스토어를 생성한다.
export const useTripStore = create<TripState>((set, get) => ({
  currentUser: null,
  trips: [],
  selectedTripId: '',
  itineraries: {},
  expenses: {},
  checklists: {},
  members: {},
  shareTokens: {},
  visits: [],

  // 간편 테스트 로그인을 수행하고 프로필을 등록한다.
  login: (nickname: string) => {
    // 신규 프로필 객체를 생성한다.
    const userProfile: Profile = {
      id: `user-${Date.now()}`,
      nickname: nickname.trim() || '여행자',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // 상태에 현재 사용자 정보를 저장한다.
    set({ currentUser: userProfile });
    return userProfile;
  },

  // 소셜 로그인 인증 완료 시 즉시 프로필을 구성하고 상태 및 DB에 동기화한다.
  loginWithSocial: async (provider, nickname, osPlatform, avatarUrl) => {
    const now = new Date().toISOString();
    const newProfile: Profile = {
      id: `user-${provider}-${Date.now()}`,
      nickname: nickname.trim() || `${provider} 여행자`,
      avatarUrl: avatarUrl || null,
      bio: null,
      travelStyles: [],
      phone: null,
      osPlatform,
      authProvider: provider,
      lastSignInAt: now,
      createdAt: now,
      updatedAt: now,
    };

    set({ currentUser: newProfile });

    try {
      await upsertSocialProfile(newProfile);
    } catch {
      // 오프라인이거나 개발 환경인 경우 로컬 상태로 안전하게 유지한다.
    }

    return newProfile;
  },

  // 게스트 둘러보기 세션을 기기 안전 저장소에 영구 보관하여 앱 삭제 전까지 유지한다.
  loginAsGuest: async (osPlatform) => {
    const guestProfile = generateGuestProfile(osPlatform);
    set({ currentUser: guestProfile });
    await saveGuestSession(guestProfile);
    return guestProfile;
  },

  // 기기 안전 저장소에서 기존 게스트 세션을 조회하여 복원한다.
  initGuestSession: async () => {
    const saved = await loadStoredGuestSession();
    if (saved) {
      set({ currentUser: saved });
      return saved;
    }
    return null;
  },

  // 인증된 사용자 프로필 객체로 전역 상태를 직접 갱신한다.
  setCurrentUser: (profile: Profile | null) => {
    // 상태의 currentUser를 전달받은 profile 객체로 설정한다.
    set({ currentUser: profile });
  },

  // 현재 로그인된 사용자의 프로필 속성을 부분 갱신한다.
  updateProfile: (updates: Partial<Profile>) => {
    // 현재 사용자가 존재할 경우 업데이트 속성을 병합하여 상태를 갱신한다.
    set((state) => {
      if (!state.currentUser) return state;
      return {
        currentUser: {
          ...state.currentUser,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  // 로그아웃을 수행하고 기기 게스트 세션을 해제한다.
  logout: () => {
    // 기기 안전 저장소의 게스트 세션을 정리한다.
    clearGuestSession().catch(() => {});
    // 사용자 정보를 null로 초기화한다.
    set({ currentUser: null });
  },

  // 현재 선택된 활성 여행 아이디를 변경한다.
  setSelectedTripId: (id: string) => {
    // 상태의 selectedTripId를 전달받은 id 값으로 갱신한다.
    set({ selectedTripId: id });
  },

  // 새로운 여행을 생성하여 목록 맨 앞에 추가한다.
  createTrip: (newTripData) => {
    const currentUserId = get().currentUser?.id || 'user-me';
    // 6자리 초대 코드를 생성한다.
    const inviteCode = generateInviteCode();
    // 고유 식별자와 생성 시각을 부여하여 새 여행 인스턴스를 생성한다.
    const createdTrip: Trip = {
      ...newTripData,
      id: `trip-${Date.now()}`,
      userId: currentUserId,
      inviteCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 상태에 새 여행을 추가하고 연관된 빈 컬렉션을 초기화한다.
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
            userId: currentUserId,
            role: 'owner',
            joinedAt: new Date().toISOString(),
          },
        ],
      },
    }));

    return createdTrip;
  },

  // 특정 여행을 스토어에서 완전히 삭제한다.
  deleteTrip: (tripId: string) => {
    // 해당 여행과 연계된 모든 데이터를 상태에서 제거한다.
    set((state) => {
      const remainingTrips = state.trips.filter((t) => t.id !== tripId);
      const nextSelected =
        state.selectedTripId === tripId
          ? remainingTrips[0]?.id || ''
          : state.selectedTripId;

      return {
        trips: remainingTrips,
        selectedTripId: nextSelected,
      };
    });
  },

  // 초대 코드로 기존 여행을 찾아 참여 멤버로 등록한다.
  joinTripByInviteCode: (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    const currentUserId = get().currentUser?.id || 'user-me';

    // 초대 코드가 일치하는 여행을 검색한다.
    const targetTrip = get().trips.find(
      (t) => (t.inviteCode || '').toUpperCase() === cleanCode,
    );

    if (!targetTrip) {
      return {
        success: false,
        message: '해당 초대 코드와 일치하는 여행을 찾을 수 없습니다.',
      };
    }

    // 이미 멤버로 등록되어 있는지 확인한다.
    const existingMembers = get().members[targetTrip.id] || [];
    const isAlreadyMember = existingMembers.some(
      (m) => m.userId === currentUserId,
    );

    if (!isAlreadyMember) {
      // 새 멤버십 객체를 추가한다.
      const newMember: TripMember = {
        id: `mem-${Date.now()}`,
        tripId: targetTrip.id,
        userId: currentUserId,
        role: 'editor',
        joinedAt: new Date().toISOString(),
      };

      set((state) => ({
        members: {
          ...state.members,
          [targetTrip.id]: [...existingMembers, newMember],
        },
      }));
    }

    return {
      success: true,
      message: `'${targetTrip.title}' 여행에 동행 멤버로 참여했습니다!`,
      trip: targetTrip,
    };
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
      const current = state.itineraries[tripId] || [];
      return {
        itineraries: {
          ...state.itineraries,
          [tripId]: [...current, newItem],
        },
      };
    });

    return newItem;
  },

  // 특정 일정을 삭제한다.
  deleteItineraryItem: (tripId: string, itemId: string) => {
    // 해당 ID의 일정을 제외한 새로운 목록으로 갱신한다.
    set((state) => {
      const current = state.itineraries[tripId] || [];
      return {
        itineraries: {
          ...state.itineraries,
          [tripId]: current.filter((item) => item.id !== itemId),
        },
      };
    });
  },

  // 일정 목록의 순서(sort_order)를 재정렬한다.
  reorderItinerary: (tripId: string, itemIds: string[]) => {
    set((state) => {
      const current = state.itineraries[tripId] || [];
      const reordered = itemIds
        .map((id, idx) => {
          const found = current.find((item) => item.id === id);
          return found ? { ...found, sortOrder: idx + 1 } : null;
        })
        .filter((item): item is ItineraryItem => item !== null);

      return {
        itineraries: {
          ...state.itineraries,
          [tripId]: reordered,
        },
      };
    });
  },

  // 특정 여행에 가계부 지출 항목을 등록한다.
  addExpense: (tripId: string, expenseData) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      tripId,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const current = state.expenses[tripId] || [];
      return {
        expenses: {
          ...state.expenses,
          [tripId]: [newExpense, ...current],
        },
      };
    });
  },

  // 체크리스트 준비물의 완료 여부를 반전한다.
  toggleChecklistItem: (tripId: string, itemId: string) => {
    set((state) => {
      const current = state.checklists[tripId] || [];
      const updated = current.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item,
      );
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
    const newItem: ChecklistItem = {
      id: `chk-${Date.now()}`,
      tripId,
      title,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const current = state.checklists[tripId] || [];
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
    const existing = get().shareTokens[tripId];
    if (existing) return existing;

    const newToken = `wherego-${tripId}-${Math.random().toString(36).substring(2, 8)}`;
    set((state) => ({
      shareTokens: {
        ...state.shareTokens,
        [tripId]: newToken,
      },
    }));
    return newToken;
  },

  // 예정된 일정 장소를 실제 방문 발자국(visits)으로 전환한다.
  checkInPlace: (tripId: string, item: ItineraryItem, method = 'gps') => {
    const newVisit: Visit = {
      id: `visit-${Date.now()}`,
      tripId,
      placeId: item.placeId,
      userId: get().currentUser?.id || 'user-me',
      visitedAt: new Date().toISOString(),
      latitude: item.place?.latitude || 33.5,
      longitude: item.place?.longitude || 126.5,
      verification: method,
      isVerified: true,
      createdAt: new Date().toISOString(),
      place: item.place,
    };

    set((state) => ({
      visits: [newVisit, ...state.visits],
    }));
  },
}));
