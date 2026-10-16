export const scheduleStarters = [
  {
    key: 'stay',
    label: '숙소부터 추가',
    title: '숙소 체크인',
    type: 'STAY',
    timeSlot: '15:00',
  },
  {
    key: 'meal',
    label: '식사부터 추가',
    title: '점심 식사',
    type: 'PLACE',
    timeSlot: '12:00',
  },
  {
    key: 'visit',
    label: '관광부터 추가',
    title: '가보고 싶은 곳',
    type: 'PLACE',
    timeSlot: '09:00',
  },
] as const;
export type ScheduleStarter = (typeof scheduleStarters)[number]['key'];

// 시작 제안은 장소 추천이나 저장 없이 작성할 초안의 종류·제목·예시 시각만 채운다.
export function starterValues(key?: ScheduleStarter): Record<string, string> {
  // 제목·시각은 사용자가 바꿀 수 있고 주소·좌표·비용은 추정하지 않는다.
  const starter = scheduleStarters.find((item) => {
    // 명시적으로 선택한 한 가지 시작 방식만 적용한다.
    return item.key === key;
  });
  return starter
    ? { title: starter.title, type: starter.type, timeSlot: starter.timeSlot }
    : {};
}
