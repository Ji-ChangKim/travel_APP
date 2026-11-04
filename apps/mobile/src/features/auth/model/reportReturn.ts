import { z } from 'zod';
export const reportReturnSchema = z.object({
  originId: z.string().uuid().nullable(),
  guest: z.boolean(),
  postId: z.string().uuid(),
  reason: z.string().max(500),
  createdAt: z.number(),
});
export function validReportReturn(
  text: string,
  account: string,
  postId: string,
  now = Date.now(),
) {
  try {
    const result = reportReturnSchema.safeParse(JSON.parse(text));
    if (!result.success) return null;
    const value = result.data;
    return value.postId === postId &&
      (value.guest || value.originId === account) &&
      now >= value.createdAt &&
      now - value.createdAt < 3600000
      ? value
      : null;
  } catch {
    return null;
  }
}
