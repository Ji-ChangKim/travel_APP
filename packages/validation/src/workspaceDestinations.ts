import { tripDestinations } from '@wherego/domain';
import type { z } from 'zod';
import type { destinationsInputSchema } from './planning';
import { tripDestinationsSchema } from './foundation';
import {
  changed,
  rejectRequest,
  type Snapshot,
  type Change,
} from './workspaceModelCore';

export function updateTripDestinations(
  snapshot: Snapshot,
  input: z.infer<typeof destinationsInputSchema>,
): Change {
  // 모든 DAY를 정확히 한 도시와 연결해야 도시 삭제가 기록을 고아로 만들지 않는다.
  const assignments = new Map(
    input.assignments.map((entry) => [entry.dayId, entry.destinationId]),
  );
  const ids = new Set(input.destinations.map((entry) => entry.id));
  if (
    ids.has(snapshot.trip.id) ||
    assignments.size !== input.assignments.length ||
    assignments.size !== snapshot.days.length ||
    !snapshot.days.every((day) => assignments.has(day.id)) ||
    input.assignments.some((entry) => !ids.has(entry.destinationId))
  )
    return rejectRequest('VALIDATION_FAILED');
  const primary = input.destinations[0]!;
  return changed(snapshot, {
    trip: {
      ...snapshot.trip,
      country: primary.country,
      city: primary.city,
      timezone: primary.timezone,
      destinations: input.destinations,
    },
    days: snapshot.days.map((day) => ({
      ...day,
      destinationId: assignments.get(day.id)!,
    })),
  });
}

// 기존 메타데이터 편집도 대표 여행지와 도시 목록을 다르게 만들지 않는다.
export function representativeDestinations(
  snapshot: Snapshot,
  country: string,
  city: string,
) {
  return snapshot.trip.destinations
    ? tripDestinationsSchema.parse(
        tripDestinations(snapshot.trip).map((destination, index) =>
          index === 0 ? { ...destination, country, city } : destination,
        ),
      )
    : undefined;
}
