import { create } from 'zustand';

// 알림 권한을 새로 선택한 시점만 예약 화면에 전달한다.
export const usePermissionRevision = create<{ revision: number }>(() => {
  // 최초 실행에는 운영체제의 실제 권한을 조회한다.
  return { revision: 0 };
});

// 운영체제 권한 요청을 마친 후 알림 예약을 갱신한다.
export function changedPermission(): void {
  // 앱 내 선택은 단순 갱신 신호이며 실제 허용 여부는 다시 확인한다.
  return usePermissionRevision.setState((state) => {
    // 이전 예약 요청과 권한 선택을 구분한다.
    return { revision: state.revision + 1 };
  });
}
