import type { WorkspaceSchedule } from '@wherego/domain';
import type { TripIconName } from '@/components/icons/TripIcon';

export const scheduleKinds: {
  type: WorkspaceSchedule['type'];
  label: string;
  icon: TripIconName;
}[] = [
  { type: 'PLACE', label: '장소', icon: 'map-pin-duotone' },
  { type: 'STAY', label: '숙소', icon: 'hotel-duotone' },
  { type: 'TRANSPORT', label: '이동', icon: 'bus-duotone' },
  { type: 'RESERVATION', label: '예약', icon: 'ticket-outline' },
  { type: 'TODO', label: '할 일', icon: 'checklist-outline' },
  { type: 'MEMO', label: '메모', icon: 'journal-outline' },
];

// 일정의 실제 유형을 사용자에게 익숙한 이름으로 바꾼다.
export function scheduleKind(type: WorkspaceSchedule['type']) {
  // 등록된 표준 분류만 사용한다.
  return scheduleKinds.find((kind) => {
    // 해당 일정과 같은 유형의 표현을 선택한다.
    return kind.type === type;
  })!;
}

// 현지 달력 날짜를 짧은 한국어 날짜로 표현한다.
export function scheduleDate(date: string): string {
  // 기기의 시간대가 여행 날짜를 바꾸지 않게 UTC로 표시한다.
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

// 입력한 체류시간을 시간과 분으로 읽기 쉽게 표시한다.
export function scheduleDuration(minutes: number): string {
  // 입력하지 않은 시간이나 이동시간을 추정하지 않는다.
  return [
    minutes >= 60 ? `${Math.floor(minutes / 60)}시간` : '',
    minutes % 60 ? `${minutes % 60}분` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// 선택 날짜의 실제 방문 순서를 읽는다.
export function schedulesForDay(
  items: WorkspaceSchedule[],
  dayId: string,
): WorkspaceSchedule[] {
  // 조회 배열을 직접 수정하지 않는다.
  return items
    .filter((item) => {
      // 다른 날짜를 목록에 섞지 않는다.
      return item.dayId === dayId;
    })
    .sort((a, b) => {
      // 같은 시각의 일정도 저장된 순서를 따른다.
      return a.sortOrder - b.sortOrder;
    });
}
