import type { TripLifecycle } from '@wherego/domain';
import { tripPhaseLabels } from './tripPresentation';

// 편집 화면의 저장 상태 이름도 같은 공통 사전을 사용한다.
export function tripStatusLabel(status: string): string {
  // 알 수 없는 내부 식별자는 그대로 노출하지 않는다.
  return tripPhaseLabels[status as TripLifecycle] || '여행 상태 확인 중';
}

// 동행의 역할을 할 수 있는 행동으로 설명한다.
export function memberRoleLabel(role: string): string {
  // 내부 권한 코드 대신 여행자에게 필요한 권한 의미만 전달한다.
  return (
    (
      {
        owner: '여행 만든 사람',
        editor: '함께 편집',
        viewer: '보기 전용',
      } as Record<string, string>
    )[role] || '권한 확인 중'
  );
}

// 여행 상세의 작업 영역을 같은 순서와 이름으로 표시한다.
export const workspaceSections = [
  ['itinerary', '일정'],
  ['map', '지도'],
  ['expenses', '비용'],
  ['photos', '사진·영수증'],
  ['preparation', '준비물'],
  ['companions', '동행'],
  ['share', '발자국 공유'],
] as const;
