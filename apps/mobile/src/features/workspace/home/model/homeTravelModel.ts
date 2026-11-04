import type { PersistedTrip } from '@wherego/domain';
import { tripToday } from '@wherego/domain';
import { calendarDateSchema } from '@wherego/validation';
import type { CreationDraft } from '../../planning/model/creationDraftModel';

export type HomeTravel = {
  id: string;
  title: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  timezone: string;
  trip?: PersistedTrip;
  draft?: CreationDraft;
};

// 초안은 날짜가 있어도 작성 중이며 정식 여행의 일정·영수증 행동을 제공하지 않는다.
export function homeTravelGroups(
  trips: PersistedTrip[],
  drafts: CreationDraft[],
  now = new Date(),
) {
  const items: HomeTravel[] = [
    ...trips
      .filter(
        (trip) => trip.status !== 'ARCHIVED' && trip.status !== 'COMPLETED',
      )
      .map((trip) => ({ ...trip, trip })),
    ...drafts
      .filter((draft) => !trips.some((trip) => trip.id === draft.form.id))
      .map((draft) => ({
        id: draft.form.id,
        title: draft.form.values.title || draft.form.values.city || '',
        country: draft.form.values.country || '',
        city: draft.form.values.city || '',
        startDate: draft.form.values.startDate || '',
        endDate: draft.form.values.endDate || '',
        timezone: draft.form.values.timezone || 'Asia/Seoul',
        draft,
      })),
  ];
  const undated = items.filter(
    (item) =>
      item.draft || !calendarDateSchema.safeParse(item.startDate).success,
  );
  const dated = items.filter(
    (item) =>
      !item.draft && calendarDateSchema.safeParse(item.startDate).success,
  );
  const future = dated
    .filter((item) => homeDaysLeft(item, now) >= 0)
    .sort(
      (a, b) =>
        homeDaysLeft(a, now) - homeDaysLeft(b, now) ||
        a.startDate.localeCompare(b.startDate) ||
        a.id.localeCompare(b.id),
    );
  const active = dated
    .filter(
      (item) =>
        homeDaysLeft(item, now) < 0 &&
        item.endDate >= tripToday(item.timezone, now),
    )
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    );
  return { upcoming: future[0], scheduled: future.slice(1), undated, active };
}

// 달력 날짜를 UTC 날짜 수로 변환해 서머타임 때문에 D-day가 달라지지 않게 한다.
export function homeDaysLeft(item: HomeTravel, now = new Date()): number {
  return Math.round(
    (Date.parse(item.startDate) - Date.parse(tripToday(item.timezone, now))) /
      86400000,
  );
}
