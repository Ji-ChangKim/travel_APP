import type { PlanForm } from './forms';

// 원본 일정과 별개로 저장할 복사 초안을 만든다.
export function copiedScheduleForm(
  original: PlanForm,
  fresh: PlanForm,
): PlanForm {
  // 내용·예상 비용을 이어받되 새 ID를 쓰고 항공편 이외의 시간은 다시 정한다.
  return {
    kind: 'schedule',
    id: fresh.id,
    copySourceTitle: original.values.title || '',
    values: {
      ...original.values,
      sortOrder: fresh.values.sortOrder || '1',
      timeSlot:
        original.values.flightEnabled === 'true'
          ? original.values.timeSlot || ''
          : '',
      afterScheduleId: 'last',
    },
  };
}
