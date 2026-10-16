import type { DiscoveryDestination } from '@wherego/domain';
import type { DiscoveryCity, DestinationDiscovery } from '@wherego/validation';
import credits from '../../../assets/destinations/credits.json';

type CityKey = DiscoveryDestination['key'];
export interface GuideAttribution {
  id: string;
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string | null;
  changes: string;
  checkedAt?: string;
}

// 실제 표시하는 도시와 원문 문서가 함께 일치하는 소개만 사용한다.
export function matchingCityStory(
  city: DiscoveryDestination,
  data?: DestinationDiscovery,
): DiscoveryCity | undefined {
  // 다른 도시의 원문이나 잘못된 주소를 같은 도시 소개의 출처로 표시하지 않는다.
  return data?.cities.find((item) => {
    // 도시 키와 문서 경로를 모두 확인한다.
    return (
      item.key === city.key && matchesArticle(item.sourceUrl, city.article)
    );
  });
}

// 검증된 한국어 위키백과의 해당 문서만 허용한다.
function matchesArticle(url: string, article: string): boolean {
  // URL 디코딩 실패도 다른 도시의 원문으로 대체하지 않는다.
  try {
    // 실제 원문 제목과 HTTPS 주소를 대조한다.
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'ko.wikipedia.org' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      decodeURIComponent(parsed.pathname) === `/wiki/${article}`
    );
  } catch {
    // 잘못된 외부 주소는 추가 소개를 숨기고 기본 가이드를 유지한다.
    return false;
  }
}

// 도시별 실제 포함 사진의 저작자·라이선스·변경 이력을 반환한다.
export function photoAttribution(key: CityKey): GuideAttribution {
  // 다운로드 URL 대신 파일 설명 페이지를 원문으로 사용한다.
  return {
    id: 'photo',
    title: decodeURIComponent(
      credits[key].sourceUrl.split('/wiki/File:')[1]!,
    ).replaceAll('_', ' '),
    author: credits[key].author,
    sourceUrl: credits[key].sourceUrl,
    license: credits[key].license,
    licenseUrl: credits[key].licenseUrl,
    changes: credits[key].changes,
    checkedAt: credits[key].checkedAt,
  };
}

// 관광청 참고 자료에는 사진의 CC 라이선스를 섞지 않는다.
export function informationAttributions(
  sources: { label: string; url: string }[],
): GuideAttribution[] {
  // 참고 자료의 제공 기관과 한국어 편집 사실을 각각 표시한다.
  return sources.map((source) => {
    // 해당 도시 가이드가 실제 사용하는 원문 목록만 변환한다.
    return {
      id: source.url,
      title: source.label,
      author: source.label.split(' · ')[0]!,
      sourceUrl: source.url,
      license: '원문 사이트의 이용 조건 적용',
      licenseUrl: null,
      changes:
        'TripPrint가 이 자료를 참고해 소개·볼거리·먹거리·계절 정보를 한국어로 작성했어요.',
    };
  });
}

// 화면에 실제 발췌한 도시 이야기의 출처만 추가한다.
export function storyAttribution(
  city: DiscoveryDestination,
  story?: DiscoveryCity,
): GuideAttribution | null {
  // 조회 실패·도시 불일치에서는 발췌나 라이선스를 표시한 것처럼 꾸미지 않는다.
  return story &&
    story.key === city.key &&
    matchesArticle(story.sourceUrl, city.article)
    ? {
        id: 'story',
        title: `${city.city} 도시 이야기`,
        author: '한국어 위키백과 기여자',
        sourceUrl: story.sourceUrl,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        changes:
          '원문 소개를 일반 텍스트로 일부 발췌하고 앞뒤 공백과 길이를 정리했어요.',
      }
    : null;
}

// 외부 열기에는 실제 출처로 제공한 HTTPS 주소만 사용한다.
export function requireGuideUrl(url: string): string {
  // 다른 앱 실행·파일 접근·인증 정보가 든 URL을 열지 않는다.
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error(
      '출처 주소를 열 수 없어요. 가이드로 돌아가 다시 확인해 주세요.',
    );
  return parsed.href;
}
