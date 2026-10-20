import type { WorkspaceSchedule } from '@wherego/domain';

const keys = [
  'planDescription',
  'planChoiceGroup',
  'planChoiceLabel',
  'planChoiceKind',
];

// 공개 설명이나 후보 관계 중 하나를 작성했다면 같은 저장 객체로 변환한다.
export function schedulePlanInput(values: Record<string, string>): {
  planContent?: WorkspaceSchedule['planContent'];
} {
  // 기존 필드를 전혀 받지 않은 구버전 폼은 서버의 이전 값 보존 계약을 따른다.
  return keys.some((key) => {
    // 설명을 입력하지 않고 후보 묶음만 작성한 경우도 포함한다.
    return values[key] !== undefined;
  })
    ? { planContent: planContent(values) }
    : {};
}

// 묶음 해제 시 숨겨진 안내가 남아 그룹 의존 검증에 실패하지 않게 한다.
function planContent(
  values: Record<string, string>,
  group = values.planChoiceGroup?.trim() ? values.planChoiceGroup : '',
): WorkspaceSchedule['planContent'] {
  // 설명 원문은 공백과 줄바꿈을 바꾸지 않고 명시적 전체 비우기만 null로 보낸다.
  return values.planDescription || group
    ? {
        description: values.planDescription || '',
        ...(group
          ? {
              choiceGroup: group,
              choiceLabel: values.planChoiceLabel || '',
              choiceKind:
                values.planChoiceKind === 'backup' ? 'backup' : 'choice',
            }
          : {}),
      }
    : null;
}
