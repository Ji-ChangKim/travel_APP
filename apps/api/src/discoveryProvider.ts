import { z } from 'zod';
import {
  discoveryDestinations,
  type DiscoveryDestination,
} from '@wherego/domain';
import { discoveryImageSchema, type DiscoveryCity } from '@wherego/validation';
import { readBounded } from './ocr';

const agent =
  'TripPrint/0.1 (https://github.com/Ji-ChangKim/travel_APP; destination discovery)';
const pagesSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string().max(500),
        extract: z.string().max(2000).optional(),
        pageimage: z.string().max(500).optional(),
        fullurl: z.string().url().optional(),
      }),
    ),
  }),
});
const imagesSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        imageinfo: z
          .array(
            z.object({
              thumburl: z.string().optional(),
              descriptionurl: z.string(),
              extmetadata: z.record(
                z.string(),
                z.object({ value: z.string().max(10000) }),
              ),
            }),
          )
          .optional(),
      }),
    ),
  }),
});
const viewsSchema = z.object({
  items: z
    .array(
      z.object({
        timestamp: z.string().regex(/^\d{10}$/),
        views: z.number().int().nonnegative(),
      }),
    )
    .max(3),
});
type Page = z.infer<typeof pagesSchema>['query']['pages'][number];
type ImagePage = z.infer<typeof imagesSchema>['query']['pages'][number];

// 한 공급자의 크기·시간 제한이 있는 JSON만 읽는다.
export function readDiscoveryJson(
  fetcher: typeof fetch,
  url: string,
): Promise<unknown> {
  // 사용자의 토큰·IP·개인 여행 정보는 공급자에게 전달하지 않는다.
  return fetcher(url, {
    headers: { 'User-Agent': agent, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
    redirect: 'manual',
  })
    .then((response) => {
      // 압축 여부와 Content-Length에 관계없이 실제 본문 크기를 제한한다.
      return readBounded(response, 524288);
    })
    .then((bytes) => {
      // HTML과 공급자 오류 본문을 앱의 소개 문구로 사용하지 않는다.
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    });
}

// 한 번의 공식 Action API 요청으로 선정한 도시의 소개를 읽는다.
export function discoveryPages(fetcher: typeof fetch): Promise<Page[]> {
  // 제목 목록은 고정 카탈로그만 사용하여 무제한 검색을 허용하지 않는다.
  return readDiscoveryJson(
    fetcher,
    `https://ko.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'extracts|pageimages|info',
      exintro: '1',
      explaintext: '1',
      exchars: '300',
      piprop: 'name',
      inprop: 'url',
      titles: discoveryDestinations
        .map((city) => {
          // 원문 문서 제목과 조회 통계의 제목을 일치시킨다.
          return city.article;
        })
        .join('|'),
    })}`,
  ).then((data) => {
    // 문서 누락은 임의 소개를 만들어 채우지 않는다.
    return pagesSchema.parse(data).query.pages;
  });
}

// 실제 라이선스와 저작자를 확인한 공용 저장소 사진만 사용한다.
export function discoveryImages(
  fetcher: typeof fetch,
  pages: Page[],
): Promise<ImagePage[]> {
  // 사진이 없는 도시 때문에 다른 도시의 소개가 실패하지 않게 한다.
  return pages.some((page) => {
    // 대표 파일명이 있는 문서만 사진 메타데이터를 조회한다.
    return Boolean(page.pageimage);
  })
    ? readDiscoveryJson(
        fetcher,
        `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
          action: 'query',
          format: 'json',
          formatversion: '2',
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          iiurlwidth: '640',
          iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
          titles: pages
            .filter((page) => {
              // 누락 문서에 잘못된 파일 제목을 만들지 않는다.
              return Boolean(page.pageimage);
            })
            .map((page) => {
              // API의 파일 제목만 사용하고 이미지 URL을 직접 추측하지 않는다.
              return `File:${page.pageimage}`;
            })
            .join('|'),
        })}`,
      )
        .then((data) => {
          // 저작자 정보가 없는 사진은 아래 검증에서 제외한다.
          return imagesSchema.parse(data).query.pages;
        })
        .catch(() => {
          // 사진 조회 실패는 사진 없는 도시 카드로 복구한다.
          return [];
        })
    : Promise.resolve([]);
}

// 위키 파일명의 공백 정규화를 동일하게 처리한다.
function filename(value: string): string {
  // 파일명 비교만 하며 외부 경로를 열지 않는다.
  return value.replace(/^File:/, '').replaceAll('_', ' ');
}

// HTML 저작자 표기는 실행하지 않고 일반 텍스트로 축약한다.
function authorText(value: string): string {
  // 앱은 HTML을 렌더링하지 않으며 원문 저작자 페이지도 함께 제공한다.
  return value
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .trim()
    .slice(0, 500);
}

// 상업 이용·표시 조건을 확인할 수 있는 이미지 정보만 노출한다.
function licensedImage(
  page: Page,
  images: ImagePage[],
): DiscoveryCity['image'] {
  // API가 지정한 파일과 일치하는 Commons 원본만 선택한다.
  return checkedImage(
    images.find((image) => {
      // 다른 도시의 사진이나 누락 파일을 임의로 대체하지 않는다.
      return filename(image.title) === filename(page.pageimage || '');
    })?.imageinfo?.[0],
  );
}

// 허용 라이선스와 HTTPS 출처를 응답 계약으로 검증한다.
function checkedImage(
  info: ImagePage['imageinfo'] extends (infer T)[] | undefined
    ? T | undefined
    : never,
): DiscoveryCity['image'] {
  // 라이선스가 불명확하거나 저작자가 비어 있으면 사진을 제공하지 않는다.
  return info &&
    /^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/.test(
      info.extmetadata.LicenseShortName?.value || '',
    )
    ? acceptedImage(
        discoveryImageSchema.safeParse({
          url: info.thumburl,
          sourceUrl: info.descriptionurl,
          author: authorText(info.extmetadata.Artist?.value || ''),
          license: info.extmetadata.LicenseShortName?.value,
          licenseUrl: info.extmetadata.LicenseUrl?.value,
        }),
      )
    : null;
}

// 검사 실패 객체를 공개 데이터로 바꾸지 않는다.
function acceptedImage(
  result: ReturnType<typeof discoveryImageSchema.safeParse>,
): DiscoveryCity['image'] {
  // 알 수 없는 이미지 호스트와 라이선스 URL을 모두 제외한다.
  return result.success ? result.data : null;
}

// 월간 조회는 두 개의 완료된 달만 같은 기준으로 요청한다.
export function discoveryViews(
  fetcher: typeof fetch,
  destination: DiscoveryDestination,
  periods: [string, string],
): Promise<{ currentViews: number; previousViews: number } | null> {
  // 사용자 조회만 집계하며 봇 접근은 제외한다.
  return readDiscoveryJson(
    fetcher,
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia.org/all-access/user/${encodeURIComponent(destination.article)}/monthly/${periods[0]!.replace('-', '')}0100/${monthEnd(periods[1])}`,
  )
    .then((data) => {
      // 두 달 중 하나라도 누락되면 0으로 채워 순위를 만들지 않는다.
      return pairedViews(viewsSchema.parse(data).items, periods);
    })
    .catch(() => {
      // 통계 오류에서는 여행지 소개 자체를 계속 제공한다.
      return null;
    });
}

// 월간 API의 종료일은 최근 완료 월의 말일까지 포함한다.
function monthEnd(period: string): string {
  // 월초로 종료하면 API가 마지막 달의 하루만 집계하므로 말일을 지정한다.
  return (
    new Date(
      Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '') + '00'
  );
}

// API가 실제 반환한 두 월간 버킷을 대조한다.
function pairedViews(
  items: z.infer<typeof viewsSchema>['items'],
  periods: [string, string],
) {
  // 월간 요청의 반환 순서에 의존하지 않는다.
  return viewsPair(
    items.find((item) => {
      // 이전 완료 월에 해당하는 버킷 하나를 선택한다.
      return item.timestamp === periods[0].replace('-', '') + '0100';
    })?.views,
    items.find((item) => {
      // 최근 완료 월에 해당하는 버킷 하나를 선택한다.
      return item.timestamp === periods[1].replace('-', '') + '0100';
    })?.views,
  );
}

// 0회와 응답 누락을 구분한다.
function viewsPair(
  previousViews: number | undefined,
  currentViews: number | undefined,
) {
  // 실제 0회 버킷도 유효한 통계로 유지한다.
  return previousViews === undefined || currentViews === undefined
    ? null
    : { currentViews, previousViews };
}

// API 원문 소개와 라이선스를 검증한 사진을 앱 계약으로 조합한다.
export function discoveryCity(
  destination: DiscoveryDestination,
  pages: Page[],
  images: ImagePage[],
  views: Awaited<ReturnType<typeof discoveryViews>>,
): DiscoveryCity | null {
  // 선정 목록에 없는 문서를 임의 목적지로 노출하지 않는다.
  return cityFromPage(
    destination,
    pages.find((page) => {
      // 제목이 정확히 일치하는 문서만 사용한다.
      return page.title === destination.article;
    }),
    images,
    views,
  );
}

// 누락된 원문을 운영자 소개로 위장하지 않는다.
function cityFromPage(
  destination: DiscoveryDestination,
  page: Page | undefined,
  images: ImagePage[],
  views: Awaited<ReturnType<typeof discoveryViews>>,
): DiscoveryCity | null {
  // 사용자 입력과 공급자 오류 문자열을 소개로 넣지 않는다.
  return page?.extract?.trim() && page.fullurl
    ? {
        key: destination.key,
        excerpt: page.extract.trim().slice(0, 1000),
        sourceUrl: page.fullurl,
        image: licensedImage(page, images),
        currentViews: views?.currentViews ?? null,
        previousViews: views?.previousViews ?? null,
      }
    : null;
}
