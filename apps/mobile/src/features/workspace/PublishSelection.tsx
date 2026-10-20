import type { WorkspaceSnapshot } from '@wherego/domain';
import { renderPublicationSelection } from './PublishSelectionView';

import type { PlanForm } from './forms';
import {
  publicationIds,
  publicationIssue,
  publicationPreview,
} from './publication';

// 공개 선택과 실제 게시될 일정·사진·통화별 비용을 함께 보여 준다.
export default function PublishSelection({
  form,
  snapshot,
  userId,
  busy,
  onChange,
  mode = 'both',
}: {
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  userId: string;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  mode?: 'selection' | 'preview' | 'both';
}) {
  // 원본에서 비공개 필드를 제거하는 서버 투영을 그대로 사용한다.
  const preview = publicationPreview(snapshot, form.values);
  // 삭제된 선택은 작성한 제목과 본문을 유지하며 다시 고르게 한다.
  const issue = publicationIssue(snapshot, form.values);
  // 첫 진입의 빈 선택은 오류나 선택 초기화 행동으로 과장하지 않는다.
  const emptyPlan =
    form.values.kind === 'plan' &&
    !publicationIds(form.values.scheduleIds).length;
  // 미리보기와 선택지는 같은 최신 원본을 따른다.
  return renderPublicationSelection({
    mode,
    form,
    busy,
    onChange,
    snapshot,
    userId,
    issue,
    emptyPlan,
    preview,
  });
}
