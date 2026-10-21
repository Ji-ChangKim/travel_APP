import {
  tripDestinations,
  type WorkspaceSnapshot,
  type TripDestination,
} from '@wherego/domain';
import {
  destinationsInputSchema,
  tripDestinationsSchema,
} from '@wherego/validation';
import type { PlanForm } from './forms';

export function destinationForm(
  snapshot: WorkspaceSnapshot,
  id: string,
): PlanForm {
  // 기존 도시 ID는 유지하고 이전 단일 도시는 별도 ID로 만들어 여행 원본 ID의 공개를 막는다.
  const destinations =
    snapshot.trip.destinations ||
    tripDestinations(snapshot.trip).map((destination) => ({
      ...destination,
      id,
    }));
  return {
    kind: 'destinations',
    id,
    values: {
      destinations: JSON.stringify(destinations),
      assignments: JSON.stringify(
        snapshot.days.map((day) => ({
          dayId: day.id,
          destinationId: day.destinationId || destinations[0]!.id,
        })),
      ),
    },
  };
}

export function destinationCommandInput(values: Record<string, string>) {
  // 확정할 도시와 날짜 배정을 하나의 저장 계약으로 검증한다.
  return destinationsInputSchema.parse({
    destinations: JSON.parse(values.destinations || '[]'),
    assignments: JSON.parse(values.assignments || '[]'),
  });
}

export function destinationDraftItems(value?: string): TripDestination[] {
  // 입력 중인 문자열은 유지하고 저장할 때 공통 계약으로 검증한다.
  return value ? (JSON.parse(value) as TripDestination[]) : [];
}

export function createdDestinations(
  values: Record<string, string>,
  timezone: string,
) {
  // 추가 도시가 있을 때만 이전 여행과 호환되는 선택 필드를 저장한다.
  const additional = destinationDraftItems(values.additionalDestinations);
  return additional.length
    ? tripDestinationsSchema.parse([
        {
          id: values.destinationSeed,
          country: values.country,
          city: values.city,
          timezone,
        },
        ...additional,
      ])
    : undefined;
}
