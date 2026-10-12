import { z } from 'zod';

// 앱과 서버가 실제로 지원하는 시작 확인 계약을 정의한다.
export const startupManifestSchema = z.object({
  protocolVersion: z.number().int().positive(),
  commonDataVersion: z.string().regex(/^[a-f0-9]{64}$/),
  guestDataVersion: z.number().int().positive(),
});

export type StartupManifest = z.infer<typeof startupManifestSchema>;
