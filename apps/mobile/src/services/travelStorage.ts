import type { MemoryPost, PlaceItem, Trip } from '@/types/travel';

// 여행은 사용자가 직접 등록하기 전까지 빈 목록으로 유지한다.
let currentTrips: Trip[] = [];

// 추억은 사용자가 직접 남긴 기록만 보관한다.
let currentMemories: MemoryPost[] = [];

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
