import { z } from 'zod';

// 본인 초안만 저장하며 화면 입력 외 임의 객체와 과도한 본문을 거부한다.
export const planDraftInputSchema = z
  .object({
    step: z.enum(['basics', 'flights']),
    values: z
      .record(z.string().max(20000))
      .refine(
        (values) =>
          Object.keys(values).length <= 100 &&
          new TextEncoder().encode(JSON.stringify(values)).length <= 12000,
      ),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const serverPlanDraftSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  savedAt: z.string().datetime(),
  step: z.enum(['basics', 'flights']),
  values: z.record(z.string()),
  revision: z.number().int().positive(),
});
export const homeTipSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
});
