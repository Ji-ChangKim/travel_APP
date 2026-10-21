import { create } from 'zustand';
import type {
  ChecklistItem,
  Expense,
  ItineraryItem,
  OsPlatform,
  Profile,
  Trip,
  TripMember,
  Visit,
} from '@wherego/domain';
import {
  clearGuestSession,
  loadStoredGuestSession,
  saveGuestSession,
} from '@/services/guestAuthService';
import { signOutUser } from '@/services/authService';
import { accountChangeState, profileUpdateState } from '@/features/auth/model';
import { guestSession } from '@/services/guestSession';
import { cloudProfile } from '@/services/cloudAuth';

interface TripState {
  currentUser: Profile | null;
  // 이전 기기 기록의 조회 호환용이다. 여행 변경은 workspace 저장 경로만 사용한다.
  trips: Trip[];
  selectedTripId: string;
  itineraries: Record<string, ItineraryItem[]>;
  expenses: Record<string, Expense[]>;
  checklists: Record<string, ChecklistItem[]>;
  members: Record<string, TripMember[]>;
  shareTokens: Record<string, string>;
  visits: Visit[];
  loginAsGuest: (osPlatform: OsPlatform) => Promise<Profile>;
  setCurrentUser: (profile: Profile | null) => void;
  updateProfile: (updates: Partial<Profile>) => void;
  logout: () => Promise<void>;
}

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

  loginAsGuest: async (osPlatform) => {
    // 기기 저장이 끝나야 같은 게스트의 여행으로 다시 진입할 수 있다.
    const stored = await loadStoredGuestSession(false);
    const profile =
      stored || cloudProfile((await guestSession()).user, osPlatform);
    await saveGuestSession(profile);
    get().setCurrentUser(profile);
    return profile;
  },

  setCurrentUser: (profile) => {
    // 같은 계정의 토큰 갱신은 보존하고 계정 전환 때만 개인 캐시를 비운다.
    set((state) => accountChangeState(state.currentUser, profile));
  },

  updateProfile: (updates) => {
    // 다른 계정에서 늦게 도착한 응답은 현재 프로필에 합치지 않는다.
    set((state) => profileUpdateState(state.currentUser, updates));
  },

  logout: async () => {
    // 인증 종료 실패를 성공으로 표시하지 않으며 기기 여행 원본은 보존한다.
    const accountId = get().currentUser?.id;
    await clearGuestSession();
    const { error } = await signOutUser();
    if (error) throw error;
    if (get().currentUser?.id === accountId) get().setCurrentUser(null);
  },
}));
