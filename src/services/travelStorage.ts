import type { MemoryPost, PlaceItem, Trip } from '@/types/travel';

// 초기 데모 및 기본 여행 데이터를 정의한다.
const initialTrips: Trip[] = [
  {
    id: 'trip-1',
    title: '제주 푸른 바다 힐링 여행',
    destination: '제주특별자치도',
    startDate: '2026-10-15',
    endDate: '2026-10-18',
    coverColor: '#246A54',
    budget: 800000,
    inviteCode: 'JEJU-2026',
    companions: [
      {
        id: 'user-1',
        name: '민지 (나)',
        role: 'host',
        avatarColor: '#246A54',
        joinedAt: '2026-09-01',
      },
      {
        id: 'user-2',
        name: '준호',
        role: 'member',
        avatarColor: '#E65100',
        joinedAt: '2026-09-02',
      },
      {
        id: 'user-3',
        name: '수현',
        role: 'member',
        avatarColor: '#1565C0',
        joinedAt: '2026-09-03',
      },
    ],
    days: [
      {
        day: 1,
        date: '2026-10-15',
        places: [
          {
            id: 'p-1',
            name: '제주국제공항 도착 및 렌터카 인수',
            category: 'activity',
            time: '11:00',
            memo: '5번 게이트 앞 셔틀 탑승',
            isCompleted: true,
          },
          {
            id: 'p-2',
            name: '해녀의 집 갈치조림',
            category: 'food',
            time: '12:30',
            memo: '현지인 맛집 예약 필수',
            isCompleted: true,
          },
          {
            id: 'p-3',
            name: '함덕 해수욕장 산책',
            category: 'sightseeing',
            time: '14:30',
            memo: '에메랄드빛 바다 배경 단체 사진',
            isCompleted: false,
          },
        ],
      },
      {
        day: 2,
        date: '2026-10-16',
        places: [
          {
            id: 'p-4',
            name: '비자림 숲길 걷기',
            category: 'sightseeing',
            time: '10:00',
            memo: '피톤치드 힐링 코스 편한 신발 착용',
            isCompleted: false,
          },
          {
            id: 'p-5',
            name: '바다 전망 오션뷰 카페',
            category: 'cafe',
            time: '14:00',
            memo: '당근 케이크와 시그니처 라떼',
            isCompleted: false,
          },
        ],
      },
      {
        day: 3,
        date: '2026-10-17',
        places: [
          {
            id: 'p-6',
            name: '서귀포 올레시장 야시장 투어',
            category: 'food',
            time: '18:30',
            memo: '흑돼지 김치말이 및 딱새우회 포장',
            isCompleted: false,
          },
        ],
      },
    ],
  },
  {
    id: 'trip-2',
    title: '도쿄 골목 산책과 미식 여행',
    destination: '일본 도쿄',
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    coverColor: '#1565C0',
    budget: 1500000,
    inviteCode: 'TOKYO-777',
    companions: [
      {
        id: 'user-1',
        name: '민지 (나)',
        role: 'host',
        avatarColor: '#246A54',
        joinedAt: '2026-09-10',
      },
      {
        id: 'user-4',
        name: '서연',
        role: 'member',
        avatarColor: '#7B1FA2',
        joinedAt: '2026-09-11',
      },
    ],
    days: [
      {
        day: 1,
        date: '2026-11-20',
        places: [
          {
            id: 'p-7',
            name: '나리타 공항 스카이라이너 탑승',
            category: 'activity',
            time: '14:00',
            memo: '우에노역 직통 41분',
            isCompleted: false,
          },
        ],
      },
    ],
  },
];

// 초기 추억 기록 데이터를 정의한다.
const initialMemories: MemoryPost[] = [
  {
    id: 'mem-1',
    tripId: 'trip-1',
    tripTitle: '제주 푸른 바다 힐링 여행',
    placeName: '함덕 서우봉 해변',
    visitedDate: '2026-09-15',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    note: '바람도 시원하고 에메랄드빛 바다가 정말 그림 같았어요. 동행들과 함께 마신 감귤 에이드도 잊지 못할 추억입니다!',
    rating: 5,
    tags: ['#바다', '#힐링', '#제주도', '#우정여행'],
  },
  {
    id: 'mem-2',
    tripId: 'trip-1',
    tripTitle: '제주 푸른 바다 힐링 여행',
    placeName: '비자림 숲길',
    visitedDate: '2026-09-16',
    imageUrl:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
    note: '비 온 뒤라 흙냄새와 피톤치드가 가득했어요. 다 함께 천천히 걸으며 이야기를 나눌 수 있어 행복했습니다.',
    rating: 5,
    tags: ['#산책', '#자연', '#피톤치드'],
  },
];

// 메모리 상에서 여행 목록을 보관한다.
let currentTrips: Trip[] = [...initialTrips];

// 메모리 상에서 추억 기록 목록을 보관한다.
let currentMemories: MemoryPost[] = [...initialMemories];

// 현재 등록된 모든 여행 목록을 반환한다.
export function getTrips(): Trip[] {
  return currentTrips;
}

// 아이디로 특정 여행을 검색하여 반환한다.
export function getTripById(id: string): Trip | undefined {
  return currentTrips.find((trip) => trip.id === id);
}

// 새로운 여행을 목록의 첫 번째에 추가한다.
export function addTrip(trip: Trip): Trip {
  currentTrips = [trip, ...currentTrips];
  return trip;
}

// 특정 여행에 새로운 방문 장소를 추가한다.
export function addPlaceToDay(
  tripId: string,
  dayNumber: number,
  place: PlaceItem,
): Trip | undefined {
  return (currentTrips = currentTrips.map((trip) =>
    trip.id === tripId
      ? {
          ...trip,
          days: trip.days.map((day) =>
            day.day === dayNumber
              ? { ...day, places: [...day.places, place] }
              : day,
          ),
        }
      : trip,
  )).find((trip) => trip.id === tripId);
}

// 특정 장소의 완료 여부를 반전한다.
export function togglePlaceCompletion(
  tripId: string,
  placeId: string,
): Trip | undefined {
  return (currentTrips = currentTrips.map((trip) =>
    trip.id === tripId
      ? {
          ...trip,
          days: trip.days.map((day) => ({
            ...day,
            places: day.places.map((place) =>
              place.id === placeId
                ? { ...place, isCompleted: !place.isCompleted }
                : place,
            ),
          })),
        }
      : trip,
  )).find((trip) => trip.id === tripId);
}

// 초대 코드로 여행을 찾아 새 동행자를 등록한다.
export function joinTripByCode(
  inviteCode: string,
  userName: string,
): { success: boolean; message: string; trip?: Trip } {
  const normalizedCode = inviteCode.trim().toUpperCase();
  const targetTrip = currentTrips.find(
    (t) => t.inviteCode.toUpperCase() === normalizedCode,
  );

  if (!targetTrip) {
    return {
      success: false,
      message: '일치하는 여행 초대 코드를 찾을 수 없습니다.',
    };
  }

  const newCompanion = {
    id: `user-${Date.now()}`,
    name: userName || '새로운 동행자',
    role: 'member' as const,
    avatarColor: '#246A54',
    joinedAt: new Date().toISOString().slice(0, 10),
  };

  currentTrips = currentTrips.map((trip) =>
    trip.id === targetTrip.id
      ? { ...trip, companions: [...trip.companions, newCompanion] }
      : trip,
  );

  return {
    success: true,
    message: `'${targetTrip.title}' 여행에 동행자로 참여했습니다!`,
    trip: currentTrips.find((t) => t.id === targetTrip.id),
  };
}

// 전체 추억 기록 목록을 반환한다.
export function getMemories(): MemoryPost[] {
  return currentMemories;
}

// 새로운 추억 기록을 추가한다.
export function addMemory(memory: MemoryPost): MemoryPost {
  currentMemories = [memory, ...currentMemories];
  return memory;
}
