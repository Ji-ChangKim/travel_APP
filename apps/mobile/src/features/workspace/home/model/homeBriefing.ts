import {
  tripToday,
  type WorkspaceSnapshot,
  type WorkspaceSchedule,
} from '@wherego/domain';

type BriefingSnapshot = Pick<WorkspaceSnapshot, 'days' | 'itinerary'> & {
  trip: Pick<WorkspaceSnapshot['trip'], 'timezone'>;
};

export type TripBriefing = {
  title: string;
  date: string;
  dayNumber: number;
  timeSlot: string | null;
};

// 이미 지난 일정은 제외하고 여행지 시각의 다음 일정 한 건만 선택한다.
export function nextTripSchedule(
  snapshot: BriefingSnapshot,
  now = new Date(),
): TripBriefing | undefined {
  // 날짜와 시각은 같은 순간으로 판별하며 원본 순서를 바꾸지 않는다.
  return selectNextSchedule(
    snapshot,
    tripToday(snapshot.trip.timezone, now),
    localClock(snapshot.trip.timezone, now),
  );
}

// 여행 DAY에 연결된 일정만 날짜·시각·저장 순서로 읽는다.
function selectNextSchedule(
  snapshot: BriefingSnapshot,
  today: string,
  time: string,
): TripBriefing | undefined {
  // 시간 미정은 오늘의 예정 시각 뒤에 두고 다음 날짜보다 앞에 둔다.
  return snapshot.itinerary
    .map((item) => {
      // 연결된 DAY가 없는 일정은 브리핑에 넣지 않는다.
      return scheduleEntry(snapshot, item);
    })
    .filter((entry): entry is TripBriefing & { order: number; id: string } => {
      // 오늘 이미 지난 시각은 다음 일정으로 다시 안내하지 않는다.
      return Boolean(
        entry &&
        (entry.date > today ||
          (entry.date === today &&
            (!entry.timeSlot || entry.timeSlot >= time))),
      );
    })
    .sort((left, right) => {
      // 같은 날짜·시각에는 저장 순서와 ID로 결과를 고정한다.
      return (
        left.date.localeCompare(right.date) ||
        (left.timeSlot || '99:99').localeCompare(right.timeSlot || '99:99') ||
        left.order - right.order ||
        left.id.localeCompare(right.id)
      );
    })[0];
}

// 스냅샷의 날짜와 실제 일정 제목을 표시용 객체로 묶는다.
function scheduleEntry(snapshot: BriefingSnapshot, item: WorkspaceSchedule) {
  // 가짜 장소·이동 시간·추천 순위를 생성하지 않는다.
  const day = snapshot.days.find((candidate) => {
    // 일정이 실제로 속한 날짜를 찾는다.
    return candidate.id === item.dayId;
  });
  return day
    ? {
        title: item.title,
        date: day.tripDate,
        dayNumber: day.dayNumber,
        timeSlot:
          item.timeSlot && /^\d{2}:\d{2}$/.test(item.timeSlot)
            ? item.timeSlot
            : null,
        order: item.sortOrder,
        id: item.id,
      }
    : undefined;
}

// 여행지의 현재 시각을 24시간 형식으로 계산한다.
function localClock(timezone: string, now: Date): string {
  // 이전 여행의 잘못된 시간대도 날짜 함수와 같은 UTC 기준으로 복구한다.
  try {
    return clockParts(timezone, now);
  } catch {
    return clockParts('UTC', now);
  }
}

// 자정이 24시로 표시되지 않도록 시간 요소만 조합한다.
function clockParts(timezone: string, now: Date): string {
  // 표시 로케일에 따른 오전·오후 문구는 비교 값에 넣지 않는다.
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return ['hour', 'minute']
    .map((type) => {
      // 시각 요소 하나만 읽는다.
      return parts.find((part) => {
        /* 같은 종류의 요소를 고른다. */ return part.type === type;
      })!.value;
    })
    .join(':');
}
