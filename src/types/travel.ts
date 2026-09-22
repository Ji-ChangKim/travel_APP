// 여행 일정에 포함된 개별 방문 장소의 정보를 정의한다.
export interface PlaceItem {
  id: string;
  name: string;
  category: 'sightseeing' | 'food' | 'cafe' | 'stay' | 'activity';
  time: string;
  memo: string;
  isCompleted?: boolean;
}

// 특정 일차의 일정과 방문 장소 목록을 정의한다.
export interface DayPlan {
  day: number;
  date: string;
  places: PlaceItem[];
}

// 함께 여행하는 동행자의 프로필 정보를 정의한다.
export interface Companion {
  id: string;
  name: string;
  role: 'host' | 'member';
  avatarColor: string;
  joinedAt: string;
}

// 전체 여행의 기본 정보, 일정 및 동행자 정보를 정의한다.
export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverColor: string;
  budget?: number;
  inviteCode: string;
  days: DayPlan[];
  companions: Companion[];
}

// 다녀온 여행의 소중한 순간을 담은 기록 포스트를 정의한다.
export interface MemoryPost {
  id: string;
  tripId: string;
  tripTitle: string;
  placeName: string;
  visitedDate: string;
  imageUrl: string;
  note: string;
  rating: number;
  tags: string[];
}
