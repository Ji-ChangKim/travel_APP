import { z } from 'zod';

// 앱과 서버가 실제로 지원하는 시작 확인 계약을 정의한다.
export const startupManifestSchema = z.object({
  protocolVersion: z.number().int().positive(),
  commonDataVersion: z.string().regex(/^[a-f0-9]{64}$/),
  guestDataVersion: z.number().int().positive(),
});

export type StartupManifest = z.infer<typeof startupManifestSchema>;

export const playStoreUrl =
  'https://play.google.com/store/apps/details?id=com.tripprint.app';

// 설치 버전 정책은 공통 데이터 버전과 별도로 검증한다.
export const appConfigSchema = z
  .object({
    platform: z.literal('android'),
    channel: z.literal('play'),
    latestVersionCode: z.number().int().min(1).max(2100000000),
    minSupportedVersionCode: z.number().int().min(0).max(2100000000),
    storeUrl: z.literal(playStoreUrl),
    checkedAt: z.string().datetime(),
  })
  .strict()
  .refine((policy) => {
    // 설치할 수 없는 최소 버전이 최신 버전을 넘어가지 않게 한다.
    return policy.minSupportedVersionCode <= policy.latestVersionCode;
  });
export type AppConfig = z.infer<typeof appConfigSchema>;

export const appConfigResponseSchema = z.object({
  data: appConfigSchema.nullable(),
});

export const appConfigQuerySchema = z
  .object({
    platform: z.enum(['android', 'ios', 'web']),
    channel: z.enum(['play', 'direct', 'unknown', 'app-store', 'web']),
  })
  .strict()
  .refine((value) => {
    // 다른 플랫폼에서 Play 정책을 요청해 적용 범위를 혼동하지 않는다.
    return value.platform === 'android'
      ? ['play', 'direct', 'unknown'].includes(value.channel)
      : value.platform === 'ios'
        ? value.channel === 'app-store'
        : value.channel === 'web';
  });
