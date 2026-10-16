import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { discoveryDestinations } from '@wherego/domain';
import type { DestinationDiscovery, DiscoveryCity } from '@wherego/validation';
import {
  informationAttributions,
  matchingCityStory,
  photoAttribution,
  requireGuideUrl,
  storyAttribution,
} from '../../apps/mobile/src/features/workspace/cityGuideSources';
import credits from '../../apps/mobile/assets/destinations/credits.json';

const expected = {
  tokyo: ['Morio', 'CC BY-SA 3.0', 'Skyscrapers_of_Shinjuku_2009_January.jpg'],
  osaka: ['663highland', 'CC BY 2.5', 'Osaka_Castle_03bs3200.jpg'],
  nagoya: ['Syced', 'CC0', 'Nagoya_Castle_(77130).jpg'],
  bangkok: [
    'Ninara from Helsinki, Finland',
    'CC BY 2.0',
    '4Y1A1159_Bangkok_(33536795515).jpg',
  ],
  shanghai: [
    'xiquinhosilva',
    'CC BY 2.0',
    'Huangpu_Park_20124-Shanghai_(32208802494).jpg',
  ],
  taipei: ['毛貓大少爺', 'CC BY-SA 2.0', 'Taipei_Skyline_2022.06.29.jpg'],
  danang: [
    'Somerset999',
    'CC BY-SA 4.0',
    'Dragon_Bridge,_Da_Nang_during_day_-_20230819_(cropped).jpg',
  ],
  singapore: [
    'CEphoto, Uwe Aranas',
    'CC BY-SA 3.0',
    'Singapore_Merlion-at-Marina-Bay-01.jpg',
  ],
} as const;

// 외부 소개의 도시·문서 일치 검증용 응답을 만든다.
function discovery(story: DiscoveryCity): DestinationDiscovery {
  // 테스트 원문과 기본 가이드 자료는 구분한다.
  return {
    fetchedAt: '2026-10-15T00:00:00Z',
    period: '2026-09',
    previousPeriod: '2026-08',
    statisticsAvailable: false,
    cities: [story],
    mostRead: [],
    rising: [],
  };
}
const tokyo = discoveryDestinations[0];
const story: DiscoveryCity = {
  key: 'tokyo',
  excerpt: '도쿄 실제 소개',
  sourceUrl: 'https://ko.wikipedia.org/wiki/%EB%8F%84%EC%BF%84%EB%8F%84',
  image: null,
  currentViews: null,
  previousViews: null,
};

test('R11 8개 도시의 실제 사진·저작자·라이선스·원문이 카탈로그와 일치한다', () => {
  // 원문에서 확인한 독립 기준과 비교해 다른 도시 크레딧 재사용을 발견한다.
  return void (assert.deepEqual(
    Object.keys(credits).sort(),
    discoveryDestinations
      .map((city) => {
        // 현재 도시 카탈로그의 모든 키가 있어야 한다.
        return city.key;
      })
      .sort(),
  ),
  discoveryDestinations.forEach((city) => {
    // 사진 파일 존재와 실제 JPEG 서명을 함께 확인한다.
    const source = photoAttribution(city.key);
    const file = new URL(
      `../../apps/mobile/assets/destinations/${credits[city.key].file}`,
      import.meta.url,
    );
    assert.equal(existsSync(file), true);
    assert.equal(readFileSync(file).subarray(0, 2).toString('hex'), 'ffd8');
    assert.equal(credits[city.key].file, `${city.key}.jpg`);
    assert.equal(source.author, expected[city.key][0]);
    assert.equal(source.license, expected[city.key][1]);
    assert.equal(
      source.sourceUrl,
      `https://commons.wikimedia.org/wiki/File:${expected[city.key][2]}`,
    );
    assert.equal(new URL(source.licenseUrl!).protocol, 'https:');
    assert.match(source.changes, /960px/);
    assert.equal(source.checkedAt, '2026-10-15');
  }));
});

test('R11 다낭의 이전 자르기 변경을 보존하고 다른 도시 변경에는 섞지 않는다', () => {
  // CC BY-SA 4.0 원본 파일의 이전 변경도 읽을 수 있어야 한다.
  return void (assert.match(
    photoAttribution('danang').changes,
    /잘린 원본\(cropped\)/,
  ),
  assert.match(photoAttribution('danang').title, /\(cropped\)/),
  assert.equal(photoAttribution('tokyo').changes.includes('cropped'), false));
});

test('R11 도시 키와 실제 원문 문서가 함께 맞는 추가 소개만 선택한다', () => {
  // 다른 문서·다른 도시·실패 응답을 현재 도시의 출처로 표시하지 않는다.
  return assert.deepEqual(
    [
      matchingCityStory(tokyo, discovery(story)),
      matchingCityStory(tokyo, discovery({ ...story, key: 'osaka' })),
      matchingCityStory(
        tokyo,
        discovery({
          ...story,
          sourceUrl: 'https://ko.wikipedia.org/wiki/오사카시',
        }),
      ),
      matchingCityStory(tokyo),
    ],
    [story, undefined, undefined, undefined],
  );
});

test('R11 잘못된 원문 URL과 인증 정보·다른 포트를 가진 주소는 소개로 쓰지 않는다', () => {
  // 주소 디코딩 오류도 기본 가이드의 렌더링 오류로 번지지 않는다.
  return assert.deepEqual(
    [
      'https://ko.wikipedia.org/wiki/%ZZ',
      'https://user@ko.wikipedia.org/wiki/도쿄도',
      'https://ko.wikipedia.org:8443/wiki/도쿄도',
      'http://ko.wikipedia.org/wiki/도쿄도',
      'javascript:alert(1)',
    ].map((sourceUrl) => {
      // 공급자 계약을 우회한 자료도 원문 대응을 확인한다.
      return matchingCityStory(tokyo, discovery({ ...story, sourceUrl }));
    }),
    [undefined, undefined, undefined, undefined, undefined],
  );
});

test('R11 위키백과 발췌 표시는 실제 소개에만 붙고 사진 이용 조건과 분리한다', () => {
  // 소개가 없으면 기여자·발췌 사실을 꾸며 넣지 않는다.
  return void (assert.equal(storyAttribution(tokyo), null),
  assert.equal(storyAttribution(tokyo, { ...story, key: 'osaka' }), null),
  assert.equal(storyAttribution(tokyo, story)?.license, 'CC BY-SA 4.0'),
  assert.equal(storyAttribution(tokyo, story)?.sourceUrl, story.sourceUrl),
  assert.equal(photoAttribution('osaka').license, 'CC BY 2.5'));
});

test('R11 관광청 참고 자료의 제공 기관과 편집 사실은 CC로 임의 재라이선스하지 않는다', () => {
  // 사진이나 발췌문의 이용 조건이 관광 원문 전체로 확장되지 않는다.
  return assert.deepEqual(
    informationAttributions([
      {
        label: '도쿄 관광청 · 여행 안내',
        url: 'https://www.gotokyo.org/en/index.html',
      },
    ]).map((source) => {
      // 제공 기관과 편집 범위를 비교한다.
      return [
        source.author,
        source.license,
        source.licenseUrl,
        source.changes.includes('TripPrint'),
      ];
    }),
    [['도쿄 관광청', '원문 사이트의 이용 조건 적용', null, true]],
  );
});

test('R11 외부 열기는 HTTPS 출처만 허용하고 위험한 주소는 거부한다', () => {
  // 사용자 선택이 있어도 실행 스킴·파일·인증 정보를 외부로 넘기지 않는다.
  return void (assert.equal(
    requireGuideUrl(credits.tokyo.sourceUrl),
    credits.tokyo.sourceUrl,
  ),
  [
    'javascript:alert(1)',
    'file:///secret',
    'http://example.com',
    'https://user:password@example.com',
    'https://example.com:9443/',
  ].forEach((url) => {
    // 유효한 웹 주소와 다른 동작을 명확히 거부한다.
    assert.throws(() => requireGuideUrl(url));
  }));
});
