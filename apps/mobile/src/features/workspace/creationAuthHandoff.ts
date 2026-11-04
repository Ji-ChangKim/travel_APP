import type { PlanForm } from './forms';
import { z } from 'zod';

type Handoff = { form: PlanForm; expiresAt: number; ownerId?: string };
let pending: Handoff | undefined;
const storageKey = 'tripprint.creation.return.v1';
const handoffSchema = z.object({
  form: z.object({
    kind: z.literal('trip'),
    id: z.string().uuid(),
    values: z.record(z.string().max(20000)),
  }),
  expiresAt: z.number().finite(),
  ownerId: z.string().optional(),
});

function persist(value: Handoff): void {
  if (typeof document !== 'undefined')
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
}

function readPending(): Handoff | undefined {
  if (pending) return pending;
  try {
    if (typeof document === 'undefined') return undefined;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw || raw.length > 100000) return undefined;
    return handoffSchema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

// 웹은 OAuth 왕복을 위해 같은 탭에, 네이티브는 현재 실행 메모리에 보관한다.
export function rememberCreation(
  form: PlanForm,
  step: string,
  now = Date.now(),
): string {
  pending = {
    form: {
      ...form,
      values: { ...form.values, _creationStep: step, _authUnsaved: 'true' },
    },
    expiresAt: now + 3600000,
  };
  persist(pending);
  return form.id;
}

export function restoreCreation(
  id: string,
  ownerId?: string,
  now = Date.now(),
): PlanForm | undefined {
  pending = readPending();
  if (!pending || pending.form.id !== id || now >= pending.expiresAt)
    return undefined;
  if (pending.expiresAt > now + 3600000) return undefined;
  if (pending.ownerId && pending.ownerId !== ownerId) return undefined;
  if (ownerId) {
    pending.ownerId = ownerId;
    try {
      persist(pending);
    } catch {
      return undefined;
    }
  }
  return { ...pending.form, values: { ...pending.form.values } };
}

export function clearCreationHandoff(id: string): void {
  if (readPending()?.form.id === id) {
    pending = undefined;
    try {
      if (typeof document !== 'undefined')
        window.sessionStorage.removeItem(storageKey);
    } catch {
      /* 만료 시각도 복원을 제한한다. */
    }
  }
}

export function updateSavedCreation(
  form: PlanForm,
  step: string,
  revision: number,
): void {
  if (pending?.form.id !== form.id) return;
  pending.form = {
    ...form,
    values: {
      ...form.values,
      _creationStep: step,
      _draftRevision: String(revision),
      _authUnsaved: 'false',
    },
  };
  try {
    persist(pending);
  } catch {
    /* 서버 저장 결과는 임시 보관 실패로 되돌리지 않는다. */
  }
}
