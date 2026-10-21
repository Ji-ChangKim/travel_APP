import type { PersistedTrip } from './foundation';
import type { WorkspaceSnapshot } from './workspace';

export interface TripDestination {
  id: string;
  country: string;
  city: string;
  timezone: string;
}

export type TravelMode = 'WALK' | 'DRIVE' | 'TRANSIT';
export interface TravelLeg {
  dayId: string;
  fromScheduleId: string;
  toScheduleId: string;
  mode: TravelMode;
}

// 이전 여행도 임의 UUID를 만들지 않고 같은 대표 여행지로 읽는다.
export function tripDestinations(trip: PersistedTrip): TripDestination[] {
  return trip.destinations?.length
    ? trip.destinations
    : [
        {
          id: trip.id,
          country: trip.country,
          city: trip.city,
          timezone: trip.timezone,
        },
      ];
}

export function destinationForDay(
  snapshot: WorkspaceSnapshot,
  dayId: string,
): TripDestination {
  const destinations = tripDestinations(snapshot.trip);
  return (
    destinations.find(
      (destination) =>
        destination.id ===
        snapshot.days.find((day) => day.id === dayId)?.destinationId,
    ) || destinations[0]!
  );
}

// 장소를 옮기거나 순서를 바꾼 뒤 이전 구간을 다른 구간으로 재사용하지 않는다.
export function validTravelLeg(
  snapshot: WorkspaceSnapshot,
  leg: TravelLeg,
): boolean {
  const items = snapshot.itinerary
    .filter((item) => item.dayId === leg.dayId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const from = items.findIndex((item) => item.id === leg.fromScheduleId);
  return from >= 0 && items[from + 1]?.id === leg.toScheduleId;
}
