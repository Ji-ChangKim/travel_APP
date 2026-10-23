import type { Context, Hono } from 'hono';
import { discoveryDestinations } from '@wherego/domain';
import {
  discoverySchema,
  type DestinationDiscovery,
  type DiscoveryCity,
} from '@wherego/validation';
import {
  discoveryPages,
  discoveryImages,
  discoveryViews,
  discoveryCity,
} from './discoveryProvider';
import { readBounded } from '../../shared/http/readBounded';
import { rejectRequest } from '../../shared/errors';
import type { ApiEnvironment } from '../../shared/types';

// 월초 집계 지연을 고려해 완료된 두 달만 비교한다.
export function discoveryPeriods(now = new Date()): [string, string] {
  // 아직 끝나지 않은 이번 달을 지난달과 비교해 증가율을 왜곡하지 않는다.
  return [
    monthOffset(now, now.getUTCDate() <= 3 ? 3 : 2),
    monthOffset(now, now.getUTCDate() <= 3 ? 2 : 1),
  ];
}

// 연도 경계도 UTC 달력 연산으로 처리한다.
function monthOffset(now: Date, offset: number): string {
  // 서버 실행 지역의 시간대를 통계 집계 기준에 섞지 않는다.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    .toISOString()
    .slice(0, 7);
}

// 공급자 요청을 한 번에 네 개 이하로 제한한다.
function cityViews(
  fetcher: typeof fetch,
  periods: [string, string],
  offset = 0,
  results: Awaited<ReturnType<typeof discoveryViews>>[] = [],
): Promise<Awaited<ReturnType<typeof discoveryViews>>[]> {
  // 요청당 후보 수를 고정하고 완료된 배치 이후에만 다음 요청을 보낸다.
  return offset >= discoveryDestinations.length
    ? Promise.resolve(results)
    : Promise.all(
        discoveryDestinations.slice(offset, offset + 4).map((city) => {
          // 각 도시의 두 달을 한 요청으로 조회한다.
          return discoveryViews(fetcher, city, periods);
        }),
      ).then((batch) => {
        // 완료한 결과만 다음 배치에 전달한다.
        return cityViews(fetcher, periods, offset + 4, [...results, ...batch]);
      });
}

// 순위의 후보·기간이 모두 확보되었는지 판정한다.
function completeStatistics(cities: DiscoveryCity[]): boolean {
  // 일부 도시 누락으로 나머지가 거짓 TOP 3가 되지 않게 한다.
  return (
    cities.length === discoveryDestinations.length &&
    cities.every((city) => {
      // 응답 누락은 실제 0회와 구분한다.
      return city.currentViews !== null && city.previousViews !== null;
    })
  );
}

// 같은 후보군에서 실제 조회 수가 높은 세 도시만 고른다.
function mostRead(cities: DiscoveryCity[]) {
  // 동률은 고정 키 순서로 정렬해 재조회 때 뒤섞이지 않게 한다.
  return [...cities]
    .sort((a, b) => {
      // API의 값만 사용하고 여행객 수를 추정하지 않는다.
      return b.currentViews! - a.currentViews! || a.key.localeCompare(b.key);
    })
    .slice(0, 3)
    .map((city) => {
      // 클라이언트는 같은 응답에 존재하는 도시 키로만 카드를 조회한다.
      return city.key;
    });
}

// 비교 기준을 충족한 실제 조회 증가만 제공한다.
function rising(cities: DiscoveryCity[]) {
  // 낮은 기준값의 작은 변화를 큰 유행처럼 표시하지 않는다.
  return cities
    .filter((city) => {
      // 이전 달 최소 100회이며 실제 조회가 증가한 도시만 포함한다.
      return (
        city.previousViews! >= 100 && city.currentViews! > city.previousViews!
      );
    })
    .sort((a, b) => {
      // 조회 수 증가율이 같으면 도시 키로 정렬한다.
      return (
        b.currentViews! / b.previousViews! -
          a.currentViews! / a.previousViews! || a.key.localeCompare(b.key)
      );
    })
    .slice(0, 3)
    .map((city) => {
      // 여행 수요 증가로 이름을 바꾸지 않는다.
      return city.key;
    });
}

// 소개·사진·조회 통계를 한 번의 공개 응답으로 만든다.
export function fetchDiscovery(
  fetcher: typeof fetch,
  now = new Date(),
): Promise<DestinationDiscovery> {
  // 사용자와 무관한 고정 도시만 외부 공급자에서 읽는다.
  return discoveryData(fetcher, now, discoveryPeriods(now));
}

// 소개와 월간 통계는 독립적으로 읽어 지연을 줄인다.
function discoveryData(
  fetcher: typeof fetch,
  now: Date,
  periods: [string, string],
): Promise<DestinationDiscovery> {
  // 외부 API 실패를 예제 여행지 데이터로 바꾸지 않는다.
  return Promise.all([
    discoveryPages(fetcher).then((pages) => {
      // 사진은 월간 조회 통계가 끝나기를 기다리지 않고 소개 직후부터 읽는다.
      return discoveryImages(fetcher, pages).then((images) => {
        // 동일한 소개 문서와 대응하는 사진 결과를 묶는다.
        return { pages, images };
      });
    }),
    cityViews(fetcher, periods),
  ]).then(([{ pages, images }, views]) => {
    // 사진 조회와 월간 통계를 독립적으로 마친 뒤 실제 문서만 포함한다.
    return validatedDiscovery(
      discoveryDestinations
        .map((city, index) => {
          // API의 후보 순서는 고정 카탈로그 순서와 대응한다.
          return discoveryCity(city, pages, images, views[index] ?? null);
        })
        .filter((city): city is DiscoveryCity => {
          // 문서가 없으면 가짜 소개를 만들지 않는다.
          return city !== null;
        }),
      now,
      periods,
    );
  });
}

// 공급자 값을 공개 계약으로 최종 검증한다.
function validatedDiscovery(
  cities: DiscoveryCity[],
  now: Date,
  periods: [string, string],
): DestinationDiscovery {
  // 소개가 전부 없으면 빈 성공 대신 재시도 가능한 서비스 오류로 처리한다.
  return discoverySchema.parse({
    fetchedAt: now.toISOString(),
    period: periods[1],
    previousPeriod: periods[0],
    cities,
    statisticsAvailable: completeStatistics(cities),
    mostRead: completeStatistics(cities) ? mostRead(cities) : [],
    rising: completeStatistics(cities) ? rising(cities) : [],
  });
}

// Cloudflare의 지역 캐시에 개인정보가 없는 탐색 데이터만 보관한다.
function discoveryCache(): Promise<Cache | undefined> {
  // 로컬 단위 검사에서는 전역 캐시가 없어도 같은 공급자 경로를 실행한다.
  return typeof caches === 'undefined'
    ? Promise.resolve(undefined)
    : caches.open('tripprint-discovery-v2').catch(() => {
        // 캐시를 열지 못해도 공식 공급자에서 다시 읽는다.
        return undefined;
      });
}

// 임의 쿼리와 인증 헤더로 공급자 호출 캐시를 분할하지 않는다.
function cacheKey(c: Context<ApiEnvironment>): Request {
  // 데이터 형식과 월간 집계 범위별로 같은 키를 사용한다.
  return new Request(
    new URL(`/_discovery-cache/v2/${discoveryPeriods().join('_')}`, c.req.url),
  );
}

// 캐시 자체의 실패는 외부 조회를 막지 않는다.
function cachedDiscovery(
  cache: Cache | undefined,
  key: Request,
): Promise<DestinationDiscovery | null> {
  // 응답 본문을 검증하고 파손된 캐시는 다시 조회한다.
  return cache
    ? cache
        .match(key)
        .then((response) => {
          // 캐시 미적중은 데이터가 없다는 의미가 아니다.
          return response
            ? readBounded(response, 524288).then((bytes) => {
                // 공개 응답과 같은 형식만 다시 사용한다.
                return discoverySchema.parse(
                  JSON.parse(new TextDecoder().decode(bytes)),
                );
              })
            : null;
        })
        .catch(() => {
          // 캐시 오류에 사용자나 외부 오류 본문을 노출하지 않는다.
          return null;
        })
    : Promise.resolve(null);
}

// 원본 조회 성공을 캐시 실패 때문에 실패로 바꾸지 않는다.
function rememberDiscovery(
  cache: Cache | undefined,
  key: Request,
  data: DestinationDiscovery,
): Promise<DestinationDiscovery> {
  // 부분 통계는 짧게 보관하여 누락 통계를 다시 시도한다.
  return (
    cache
      ? cache
          .put(
            key,
            Response.json(data, {
              headers: {
                'Cache-Control': `public, max-age=${data.statisticsAvailable ? 21600 : 900}`,
              },
            }),
          )
          .catch(() => {
            // 공급자에서 확인한 데이터를 그대로 반환한다.
            return undefined;
          })
      : Promise.resolve()
  ).then(() => {
    // 세션이나 요청 식별자는 캐시에 넣지 않는다.
    return data;
  });
}

// 로그인과 사용자 게시물 없이도 탐색 가능한 여행지 API다.
function discovery(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // HTTP 미들웨어의 next 인자를 캐시 매개변수로 받지 않는다.
  return discoveryCache().then((cache) => {
    // 캐시의 수명은 현재 요청 안에서만 사용한다.
    return discoveryWithCache(fetcher, c, cache, cacheKey(c));
  });
}

// 현재 요청에 연결한 캐시에서 공개 응답을 만든다.
function discoveryWithCache(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
  cache: Cache | undefined,
  key: Request,
): Promise<Response> {
  // 실제 방문자 순위로 표시할 수 없는 조회 통계의 의미를 계약에서 분리한다.
  return cachedDiscovery(cache, key)
    .then((data) => {
      // 검증된 캐시만 재사용하고 실패 응답은 캐시하지 않는다.
      return (
        data ||
        fetchDiscovery(fetcher).then(rememberDiscovery.bind(null, cache, key))
      );
    })
    .then((data) => {
      // CORS와 요청 식별자는 현재 앱 요청에 맞춰 새로 만든다.
      return c.json({ data, meta: { requestId: c.get('requestId') } });
    })
    .catch((error: unknown) => {
      // 공개 응답에는 숨기고 서버 로그에는 실패 종류만 기록한다.
      console.error(
        JSON.stringify({
          event: 'discovery_failed',
          kind: error instanceof Error ? error.name : 'unknown',
        }),
      );
      // 공급자 원본 오류와 내부 경로를 숨기고 재시도 가능한 오류만 보낸다.
      return rejectRequest('BACKEND_UNAVAILABLE');
    });
}

// 고정 공개 경로 하나만 추가하며 개인 여행 인증은 유지한다.
export function registerDiscoveryRoutes(
  app: Hono<ApiEnvironment>,
  fetcher: typeof fetch,
): Hono<ApiEnvironment> {
  // 공개 탐색을 위해 익명 계정이나 유료 지도 요청을 만들지 않는다.
  return app.get('/public/discovery', discovery.bind(null, fetcher));
}
