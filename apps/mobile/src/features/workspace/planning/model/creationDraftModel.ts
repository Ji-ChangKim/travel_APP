import { z } from 'zod';
import type { PlanForm } from '../../shared/model/forms';

const draftSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative().optional(),
  ownerId: z.string().min(1),
  savedAt: z.string().datetime(),
  step: z.enum(['basics', 'flights']),
  form: z.object({
    kind: z.literal('trip'),
    id: z.string().uuid(),
    values: z.record(z.string().max(20000)),
  }),
});
export type CreationDraft = z.infer<typeof draftSchema>;

// 파손되거나 다른 계정의 초안은 빈 목록으로 바꾸지 않고 복원 오류로 처리한다.
export function parseCreationDrafts(
  raw: string | null,
  ownerId: string,
): CreationDraft[] {
  if (raw === null) return [];
  if (raw.length > 100000) throw new Error('DRAFT_SIZE');
  const drafts = z.array(draftSchema).max(5).parse(JSON.parse(raw));
  if (drafts.some((draft) => draft.ownerId !== ownerId))
    throw new Error('DRAFT_OWNER');
  if (new Set(drafts.map((draft) => draft.form.id)).size !== drafts.length)
    throw new Error('DRAFT_DUPLICATE');
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// 마지막으로 사용자가 저장한 단계와 멱등 키를 함께 보존한다.
export function makeCreationDraft(
  ownerId: string,
  form: PlanForm,
  step: string,
): CreationDraft {
  return draftSchema.parse({
    schemaVersion: 1,
    ownerId,
    revision: Number(form.values._draftRevision || 0),
    form,
    step,
    savedAt: new Date().toISOString(),
  });
}

// 단계는 화면 복원용이며 실제 여행 생성 입력에는 포함하지 않는다.
export function creationDraftForm(draft: CreationDraft): PlanForm {
  return {
    ...draft.form,
    values: {
      ...draft.form.values,
      _creationStep: draft.step,
      _draftRevision: String(draft.revision || 0),
    },
  };
}
