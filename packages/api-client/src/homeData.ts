import { z } from 'zod';
import {
  homeTipSchema,
  planDraftInputSchema,
  serverPlanDraftSchema,
} from '@wherego/validation';
import {
  requestFoundation,
  requestSignal,
  FoundationClientError,
  type FoundationClientOptions,
} from './foundation';

export async function listPlanDrafts(options: FoundationClientOptions) {
  const response = await requestFoundation(options, '/plan-drafts');
  return z.array(serverPlanDraftSchema).max(5).parse(response.data);
}
export async function putPlanDraft(
  options: FoundationClientOptions,
  id: string,
  input: z.infer<typeof planDraftInputSchema>,
) {
  const response = await requestFoundation(
    options,
    `/plan-drafts/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(planDraftInputSchema.parse(input)) },
  );
  return serverPlanDraftSchema.parse(response.data);
}
export async function deletePlanDraft(
  options: FoundationClientOptions,
  id: string,
  revision: number,
) {
  const response = await requestFoundation(
    options,
    `/plan-drafts/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { 'If-Match': String(revision) } },
  );
  return z.object({ deleted: z.literal(true) }).parse(response.data);
}
// 발행된 서버 콘텐츠만 표시하고 통신 실패를 기본 문구로 대체하지 않는다.
export async function getHomeTips(
  baseUrl: string,
  language: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/public/travel-tips?language=${encodeURIComponent(language)}`,
    { signal: requestSignal(signal) },
  );
  if (!response.ok) throw new FoundationClientError(response.status, null);
  return z
    .object({ data: z.array(homeTipSchema).max(100) })
    .parse(await response.json()).data;
}
