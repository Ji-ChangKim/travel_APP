import {
  listPlanDrafts,
  putPlanDraft,
  deletePlanDraft,
} from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { UserFacingError } from '@/services/userFacingError';
import { serverOptions } from './service';
import type { CreationDraft } from './creationDraftModel';

// 게스트 기기 저장을 서버 성공으로 표시하지 않고 실제 회원 세션만 사용한다.
async function options(ownerId: string) {
  const user = useTripStore.getState().currentUser;
  if (!user || user.id !== ownerId || user.authProvider === 'guest')
    throw new UserFacingError('로그인하고 계획을 저장해 주세요.');
  return serverOptions(ownerId);
}
export async function readCreationDrafts(
  ownerId: string,
): Promise<CreationDraft[]> {
  const rows = await listPlanDrafts(await options(ownerId));
  return rows.map((row) => ({
    schemaVersion: 1,
    ownerId: row.ownerId,
    savedAt: row.savedAt,
    step: row.step,
    revision: row.revision,
    form: { kind: 'trip', id: row.id, values: row.values },
  }));
}
export async function saveCreationDraft(draft: CreationDraft) {
  const values = { ...draft.form.values };
  delete values._draftRevision;
  delete values._creationStep;
  delete values._authUnsaved;
  return putPlanDraft(await options(draft.ownerId), draft.form.id, {
    step: draft.step,
    values,
    revision: draft.revision || 0,
  });
}
export async function removeCreationDraft(
  ownerId: string,
  id: string,
  revision?: number,
) {
  const current =
    revision ||
    (await readCreationDrafts(ownerId)).find((draft) => draft.form.id === id)
      ?.revision;
  if (current) await deletePlanDraft(await options(ownerId), id, current);
}
