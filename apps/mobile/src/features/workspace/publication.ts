import type { WorkspaceSnapshot } from '@wherego/domain';
import { publicSelection } from '@wherego/validation';

// 쉼표로 보관한 선택 ID를 빈 항목 없이 읽는다.
export function publicationIds(value = ''): string[] {
  // 항목을 자동 추가하거나 삭제하지 않는다.
  return value.split(',').filter(Boolean);
}

// 공개 선택을 서버와 같은 필드 묶음으로 만든다.
export function publicationInput(values: Record<string, string>) {
  // 비용은 명시적으로 선택한 경우에만 포함한다.
  return {
    ...(values.kind === 'plan' ? { kind: 'plan' as const } : {}),
    scheduleIds: publicationIds(values.scheduleIds),
    photoIds: publicationIds(values.photoIds),
    includeCosts: values.includeCosts === 'true',
  };
}

// 삭제된 선택·공개 권한·종료 상태를 최신 원본과 대조한다.
export function publicationIssue(
  snapshot: WorkspaceSnapshot,
  values: Record<string, string>,
): string {
  // 삭제된 ID를 조용히 제외한 채 게시하지 않고 사용자가 다시 선택하게 한다.
  return snapshot.myRole !== 'owner'
    ? '여행을 만든 사람만 공개할 수 있어요. 작성한 내용은 닫기 전까지 유지돼요.'
    : snapshot.trip.status === 'ARCHIVED'
      ? '보관한 여행은 공유할 수 없어요.'
      : values.kind === 'plan' &&
          publicationIds(values.scheduleIds).length === 0
        ? '공유할 장소를 한 곳 이상 골라 주세요.'
        : values.kind !== 'plan' && snapshot.trip.status !== 'COMPLETED'
          ? '공개할 기록의 정리를 먼저 마쳐 주세요. 여행 설정에서 기록 정리 완료를 선택해 주세요.'
          : publicationIds(values.scheduleIds).some((id) => {
                // 다른 여행 일정과 삭제된 일정은 같은 선택 오류로 안내한다.
                return !snapshot.itinerary.some((item) => {
                  // 실제 DAY도 남아 있어야 공개 날짜를 만들 수 있다.
                  return (
                    item.id === id &&
                    snapshot.days.some((day) => {
                      // 최신 여행의 날짜만 허용한다.
                      return day.id === item.dayId;
                    })
                  );
                });
              }) ||
              publicationIds(values.photoIds).some((id) => {
                // 영수증 원본은 어떠한 선택에서도 공개할 수 없다.
                return !snapshot.media.some((item) => {
                  // 등록된 일반 사진만 허용한다.
                  return item.id === id && item.purpose === 'photo';
                });
              })
            ? '선택한 일정이나 사진이 삭제되었거나 공개할 수 없는 항목이에요. 선택을 비우고 다시 골라 주세요. 제목과 본문은 유지돼요.'
            : '';
}

// 화면과 실제 게시 저장이 동일한 공개 결과를 사용한다.
export function publicationPreview(
  snapshot: WorkspaceSnapshot,
  values: Record<string, string>,
) {
  // 문제가 있는 선택은 렌더링 예외나 빈 성공 미리보기로 바꾸지 않는다.
  return publicationIssue(snapshot, values)
    ? null
    : publicSelection(snapshot, publicationInput(values));
}

// 사용자가 선택한 항목 한 개만 변경한다.
export function togglePublication(value: string, id: string): string {
  // 중복 ID를 추가하지 않는다.
  return (
    publicationIds(value).includes(id)
      ? publicationIds(value).filter((item) => {
          // 해제한 항목만 제외한다.
          return item !== id;
        })
      : [...publicationIds(value), id]
  ).join(',');
}
