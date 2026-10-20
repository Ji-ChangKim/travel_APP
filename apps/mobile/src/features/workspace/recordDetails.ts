import type { WorkspaceSnapshot } from '@wherego/domain';
import { diaryCosts } from './diary';

// 기록 편집에 필요한 일반 사진과 해당 장소의 실제 지출만 투영한다.
export function recordDetails(snapshot: WorkspaceSnapshot, scheduleId: string) {
  // 영수증 사진을 일반 사진에 섞거나 다른 장소의 비용을 붙이지 않는다.
  return {
    photos: snapshot.media.filter((media) => {
      // 같은 일정에 연결된 일반 사진만 읽는다.
      return media.purpose === 'photo' && media.scheduleId === scheduleId;
    }),
    costs: diaryCosts(
      snapshot.expenses.filter((expense) => {
        // 실제 지출 여부와 통화별 합산은 기존 기록 계약을 따른다.
        return expense.scheduleId === scheduleId;
      }),
    ),
  };
}
