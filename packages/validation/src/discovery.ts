import { z } from 'zod';
import { discoveryDestinations } from '@wherego/domain';

// 여행지와 출처 링크는 사전에 정한 도시·공급자로만 제한한다.
export const discoveryKeySchema = z.enum([
  discoveryDestinations[0].key,
  ...discoveryDestinations.slice(1).map((item) => {
    // 외부 응답이 임의 목적지를 생성 폼에 주입하지 못하게 한다.
    return item.key;
  }),
] as const);

// 외부 출처 URL은 허용 호스트의 HTTPS 주소만 사용한다.
export function discoveryUrl(hosts: string[]) {
  // 실행 가능한 스킴과 다른 공급자의 추적 주소를 차단한다.
  return z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      // URL 파싱 전 기본 URL 형식은 Zod가 검사한다.
      return (
        new URL(value).protocol === 'https:' &&
        hosts.includes(new URL(value).hostname) &&
        !new URL(value).username &&
        !new URL(value).password
      );
    });
}

export const discoveryImageSchema = z.object({
  url: discoveryUrl([
    'upload.wikimedia.org',
    'thumb.wikimedia.org',
    'tripprint-staging.pages.dev',
  ]),
  sourceUrl: discoveryUrl(['commons.wikimedia.org', 'media.taiwan.net.tw']),
  author: z.string().min(1).max(500),
  license: z.string().min(1).max(100),
  licenseUrl: discoveryUrl(['creativecommons.org', 'data.gov.tw']),
});

export const discoveryCitySchema = z.object({
  key: discoveryKeySchema,
  excerpt: z.string().min(1).max(1000),
  sourceUrl: discoveryUrl(['ko.wikipedia.org']),
  image: discoveryImageSchema.nullable(),
  currentViews: z.number().int().nonnegative().nullable(),
  previousViews: z.number().int().nonnegative().nullable(),
});

// 소개와 조회 지표를 방문객 순위와 구분하는 공개 응답 계약이다.
export const discoverySchema = z.object({
  fetchedAt: z.string().datetime(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  previousPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  statisticsAvailable: z.boolean(),
  cities: z.array(discoveryCitySchema).min(1).max(discoveryDestinations.length),
  mostRead: z.array(discoveryKeySchema).max(3),
  rising: z.array(discoveryKeySchema).max(3),
});

export type DestinationDiscovery = z.infer<typeof discoverySchema>;
export type DiscoveryCity = z.infer<typeof discoveryCitySchema>;
