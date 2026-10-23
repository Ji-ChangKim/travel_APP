import { discoveryImageSchema, type DiscoveryCity } from '@wherego/validation';

// 관광청이 공개 데이터로 제공한 사진만 원본 식별자·표시 의무와 함께 등록한다.
const officialImages = {
  taipei: {
    url: 'https://tripprint-staging.pages.dev/assets/destinations/taipei-101-tourism.jpg',
    sourceUrl:
      'https://media.taiwan.net.tw/zh-tw/portal/media?Keyword=%E5%8F%B0%E5%8C%97101',
    author: '대만 교통부 관광서 (交通部觀光署)',
    license: 'Taiwan Open Government Data License 1.0',
    licenseUrl: 'https://data.gov.tw/license',
  },
};

// 사진의 출처와 이용 조건을 확인한 공식 리소스를 우선 제공한다.
export function officialDiscoveryImage(key: string): DiscoveryCity['image'] {
  // 등록되지 않은 도시는 이용 허가를 추측하거나 다른 도시 사진으로 채우지 않는다.
  return key === 'taipei'
    ? discoveryImageSchema.parse(officialImages.taipei)
    : null;
}
