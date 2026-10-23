import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoveryDestinations } from '@wherego/domain';
import { persistedTripCreateSchema } from '@wherego/validation';
import { createApp } from '../src/app';
import {
  discoveryPeriods,
  fetchDiscovery,
} from '../src/features/discovery/discovery';

interface FixtureOptions {
  missingViews?: boolean;
  imageLicense?: string;
  imageHost?: string;
  missingPage?: boolean;
  pageStatus?: number;
  oversized?: boolean;
}

// 공급자 경계만 대체하고 실제 공개 라우트와 응답 검증을 실행한다.
function fixture(calls: Request[], options: FixtureOptions = {}): typeof fetch {
  // 사용자 인증 토큰이 공급자에 전달되는지도 기록한다.
  return (input, init) => {
    // 요청 기록과 고정 공급자 응답을 같은 흐름으로 생성한다.
    return Promise.resolve(
      fixtureResponse(new Request(input, init), calls, options),
    );
  };
}

// 고정 공급자별 응답만 반환하며 다른 주소는 검사 실패로 처리한다.
function fixtureResponse(
  request: Request,
  calls: Request[],
  options: FixtureOptions,
): Response {
  // 임의 검색이나 외부 URL이 코드에서 생기지 않는지 확인한다.
  return (
    calls.push(request),
    new URL(request.url).hostname === 'ko.wikipedia.org'
      ? pageResponse(options)
      : new URL(request.url).hostname === 'commons.wikimedia.org'
        ? imageResponse(options)
        : viewResponse(request, options)
  );
}

// 실제 API 모양의 소개 응답을 만든다.
function pageResponse(options: FixtureOptions): Response {
  // 실패와 본문 상한을 별도로 검사할 수 있게 한다.
  return options.oversized
    ? new Response('x'.repeat(524289))
    : Response.json(
        {
          query: {
            pages: discoveryDestinations
              .slice(options.missingPage ? 1 : 0)
              .map((city) => {
                // 앱 데이터가 아닌 공급자 원문 형식으로만 대체한다.
                return {
                  title: city.article,
                  extract: `${city.city}의 소개입니다.`,
                  pageimage: `${city.key}_photo.jpg`,
                  fullurl: `https://ko.wikipedia.org/wiki/${encodeURIComponent(city.article)}`,
                };
              }),
          },
        },
        { status: options.pageStatus || 200 },
      );
}

// 사진의 표시 허용 여부를 결정하는 메타데이터를 제공한다.
function imageResponse(options: FixtureOptions): Response {
  // 사진의 호스트와 라이선스를 각각 변조할 수 있게 한다.
  return Response.json({
    query: {
      pages: discoveryDestinations.map((city) => {
        // 공급자의 파일명 공백 정규화도 실제로 검증한다.
        return {
          title: `File:${city.key} photo.jpg`,
          imageinfo: [
            {
              thumburl: `https://${options.imageHost || 'upload.wikimedia.org'}/wikipedia/commons/${city.key}.jpg`,
              descriptionurl: `https://commons.wikimedia.org/wiki/File:${city.key}_photo.jpg`,
              extmetadata: {
                Artist: { value: '<a href="/user">사진가</a>' },
                LicenseShortName: {
                  value: options.imageLicense || 'CC BY-SA 4.0',
                },
                LicenseUrl: {
                  value: 'https://creativecommons.org/licenses/by-sa/4.0/',
                },
              },
            },
          ],
        };
      }),
    },
  });
}

// 요청한 두 완료 월의 실제 버킷 형식을 제공한다.
function viewResponse(request: Request, options: FixtureOptions): Response {
  // 월간 API를 사용하고 봇을 제외하는 경로인지 확인한다.
  return (
    assert.equal(new URL(request.url).hostname, 'wikimedia.org'),
    assert.match(request.url, /\/all-access\/user\/.*\/monthly\//),
    assertMonthEnd(new URL(request.url).pathname.split('/').at(-1)!),
    viewsForUrl(new URL(request.url), options)
  );
}

// 종료일이 마지막 달 전체를 포함해야 올바른 월간 순위가 된다.
function assertMonthEnd(stamp: string): void {
  // 월초 종료로 하루치 조회만 포함하는 회귀를 차단한다.
  return assert.equal(
    Number(stamp.slice(6, 8)),
    new Date(
      Date.UTC(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)), 0),
    ).getUTCDate(),
  );
}

// 통계 하나의 누락이 전체 순위를 막는지 검사한다.
function viewsForUrl(url: URL, options: FixtureOptions): Response {
  // 마지막 두 URL 구간은 API가 요구하는 시작·종료 월이다.
  return Response.json({
    items: [
      { timestamp: url.pathname.split('/').at(-2), views: 100 },
      ...(options.missingViews &&
      url.pathname.includes(encodeURIComponent('나고야시'))
        ? []
        : [
            {
              timestamp: url.pathname.split('/').at(-1)!.slice(0, 6) + '0100',
              views:
                (discoveryDestinations.findIndex((city) => {
                  // 고정 도시 제목으로만 통계를 대응시킨다.
                  return url.pathname.includes(
                    encodeURIComponent(city.article),
                  );
                }) +
                  1) *
                200,
            },
          ]),
    ],
  });
}

test('월말·연도 경계와 월초 집계 지연은 완료된 두 달만 선택한다', () => {
  // 이번 달의 일부 조회 수를 지난달 전체와 비교하지 않는다.
  return (
    assert.deepEqual(discoveryPeriods(new Date('2026-01-12T00:00:00Z')), [
      '2025-11',
      '2025-12',
    ]),
    assert.deepEqual(discoveryPeriods(new Date('2026-10-02T00:00:00Z')), [
      '2026-07',
      '2026-08',
    ]),
    assert.deepEqual(discoveryPeriods(new Date('2026-10-12T00:00:00Z')), [
      '2026-08',
      '2026-09',
    ])
  );
});

test('탐색 도시 전체가 실제 여행 생성의 통화·시간대 검증을 통과한다', () => {
  // 상세에서 선택한 도시가 생성 페이지에서 거부되는 회귀를 막는다.
  return discoveryDestinations.forEach((city) => {
    // 소개 문서의 제목 대신 실제 여행 국가·도시를 전달한다.
    return assert.ok(
      persistedTripCreateSchema.safeParse({
        title: `${city.city} 여행`,
        country: city.country,
        city: city.city,
        timezone: city.timezone,
        defaultCurrency: city.currency,
        startDate: '2026-10-15',
        endDate: '2026-10-18',
      }).success,
      city.key,
    );
  });
});

test('방문자 공개 탐색은 실제 소개·사진 출처·두 달 통계로 순위를 만들고 인증하지 않는다', async () => {
  // 개인 여행이나 과금 지도 API를 호출하지 않는다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    '/public/discovery?url=https://evil.example',
    {},
    {},
  );
  const result = (await response.json()) as {
    data: Awaited<ReturnType<typeof fetchDiscovery>>;
  };
  assert.equal(response.status, 200);
  assert.equal(result.data.cities.length, 8);
  assert.equal(result.data.statisticsAvailable, true);
  assert.deepEqual(result.data.mostRead, ['singapore', 'danang', 'taipei']);
  assert.equal(result.data.cities[0]!.image?.author, '사진가');
  assert.equal(calls.length, 10);
  assert.ok(
    calls.every(
      (request) =>
        !request.headers.has('Authorization') &&
        request.headers.get('User-Agent')?.startsWith('TripPrint/'),
    ),
  );
});

test('한 도시의 월간 버킷 누락은 가짜 0회나 축소된 후보 순위를 만들지 않는다', async () => {
  // 소개는 유지하되 순위와 증가율을 모두 보류한다.
  const result = await fetchDiscovery(
    fixture([], { missingViews: true }),
    new Date('2026-10-12T00:00:00Z'),
  );
  assert.equal(result.cities.length, 8);
  assert.equal(result.statisticsAvailable, false);
  assert.equal(
    result.cities.find((city) => city.key === 'nagoya')?.currentViews,
    null,
  );
  assert.deepEqual(result.mostRead, []);
  assert.deepEqual(result.rising, []);
});

test('누락된 도시 소개는 위조하지 않고 후보군이 달라지면 순위를 보류한다', async () => {
  // 응답한 실제 도시 소개만 제공한다.
  const result = await fetchDiscovery(fixture([], { missingPage: true }));
  assert.equal(result.cities.length, 7);
  assert.equal(result.statisticsAvailable, false);
  assert.deepEqual(result.mostRead, []);
});

test('상업 이용 불가 사진과 다른 호스트 사진은 표시 데이터에서 제외한다', async () => {
  // 소개가 성공해도 검증하지 못한 사진은 제공하지 않는다.
  const noncommercial = await fetchDiscovery(
    fixture([], { imageLicense: 'CC BY-NC 4.0' }),
  );
  const foreign = await fetchDiscovery(
    fixture([], { imageHost: 'evil.example' }),
  );
  assert.ok(
    noncommercial.cities
      .filter((city) => {
        // 공식 사진이 별도 등록된 도시는 Commons 검사와 분리한다.
        return city.key !== 'taipei';
      })
      .every((city) => {
        // 상업 이용 불가 사진은 공개 응답에서 제외한다.
        return city.image === null;
      }),
  );
  assert.ok(
    foreign.cities
      .filter((city) => {
        // 등록된 공식 사진은 임의 공급자 이미지로 덮어쓰지 않는다.
        return city.key !== 'taipei';
      })
      .every((city) => {
        // 다른 호스트의 사진을 공개 자료로 허용하지 않는다.
        return city.image === null;
      }),
  );
  assert.equal(
    noncommercial.cities.find((city) => {
      // 공식 관광청 사진의 실제 출처를 확인한다.
      return city.key === 'taipei';
    })?.image?.sourceUrl,
    'https://media.taiwan.net.tw/zh-tw/portal/media?Keyword=%E5%8F%B0%E5%8C%97101',
  );
});

test('월간 통계가 대기 중이어도 사진 조회가 먼저 시작된다', async () => {
  // 통계와 무관한 사진 요청을 뒤로 미뤄 사용자 대기를 늘리지 않는다.
  let releaseViews!: () => void;
  let photoStarted!: () => void;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const viewGate = new Promise<void>((resolve) => {
    // 통계 공급자의 완료 시점만 제어한다.
    releaseViews = resolve;
  });
  const photoGate = new Promise<void>((resolve) => {
    // 실제 사진 공급자 호출이 시작됐는지 관찰한다.
    photoStarted = resolve;
  });
  const fetcher: typeof fetch = (input, init) => {
    // 공개 공급자별 요청 순서를 실제 조회 함수에 연결한다.
    const request = new Request(input, init);
    return new URL(request.url).hostname === 'wikimedia.org'
      ? viewGate.then(() => {
          // 통계 지연을 해제한 뒤 유효한 실제 형식의 응답을 반환한다.
          return fixtureResponse(request, [], {});
        })
      : Promise.resolve(
          new URL(request.url).hostname === 'commons.wikimedia.org'
            ? (photoStarted(), fixtureResponse(request, [], {}))
            : fixtureResponse(request, [], {}),
        );
  };
  const loading = fetchDiscovery(fetcher);
  try {
    // 통계가 끝나기 전에 사진 조회가 시작돼야 한다.
    await Promise.race([
      photoGate,
      new Promise<never>((_, reject) => {
        // 회귀로 교착되어도 검사 자체는 끝나야 한다.
        return void (watchdog = setTimeout(() => {
          // 사진 요청을 통계 이후로 미루는 회귀를 실패로 처리한다.
          return reject(new Error('사진 조회 지연'));
        }, 1000));
      }),
    ]);
  } finally {
    // 실패한 검사에서도 남은 공급자 요청을 모두 완료한다.
    clearTimeout(watchdog);
    releaseViews();
    await loading;
  }
});

test('공급자 실패와 초과 본문은 공개 503이며 원문 오류를 노출하지 않는다', async () => {
  // 실패 응답을 예제 여행지와 성공 코드로 바꾸지 않는다.
  const unavailable = await createApp(fixture([], { pageStatus: 503 })).request(
    '/public/discovery',
    {},
    {},
  );
  const oversized = await createApp(fixture([], { oversized: true })).request(
    '/public/discovery',
    {},
    {},
  );
  assert.equal(unavailable.status, 503);
  assert.equal(oversized.status, 503);
  assert.ok(!(await oversized.text()).includes('xxxx'));
});

// Workers에서 지원하는 manual 모드는 외부 리다이렉트를 따라가지 않는다.
test('공급자 리다이렉트는 다른 호스트를 호출하지 않고 503으로 거부한다', async () => {
  // redirect:error를 지원하지 않는 Workers 환경에서도 요청을 생성할 수 있어야 한다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls, { pageStatus: 302 })).request(
    '/public/discovery',
    {},
    {},
  );
  assert.equal(response.status, 503);
  assert.ok(calls.every((request) => request.redirect === 'manual'));
});
