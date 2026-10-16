import Text from '@/components/AppText';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { DiscoveryDestination } from '@wherego/domain';
import type { DiscoveryCity, DestinationDiscovery } from '@wherego/validation';
import { loadDiscovery } from './discoveryService';
import { discoveryStyles as s } from './discoveryStyles';
import DiscoveryCarousel from './DiscoveryCarousel';
import CityGuidePhoto from './CityGuidePhoto';
import {
  bundledDiscoveryCity,
  cityPhotoCredit,
  guideDestination,
} from './cityGuides';

type CityKey = DiscoveryDestination['key'];
interface Props {
  disabled: boolean;
  onPlan: (key: CityKey) => void;
}
// 월별 추천은 관광청 자료를 바탕으로 편집한 여행 아이디어다.
const ideas: CityKey[][] = [
  ['bangkok', 'singapore', 'taipei'],
  ['taipei', 'bangkok', 'osaka'],
  ['tokyo', 'osaka', 'shanghai'],
  ['osaka', 'tokyo', 'nagoya'],
  ['shanghai', 'nagoya', 'taipei'],
  ['danang', 'singapore', 'tokyo'],
  ['singapore', 'danang', 'bangkok'],
  ['danang', 'bangkok', 'singapore'],
  ['taipei', 'osaka', 'shanghai'],
  ['nagoya', 'bangkok', 'shanghai'],
  ['osaka', 'taipei', 'nagoya'],
  ['bangkok', 'singapore', 'tokyo'],
];

// 사진과 편집 가이드는 앱에 포함하고 외부 소개는 추가로 읽는다.
export default function HomeDiscovery({ disabled }: Props) {
  // 외부 조회가 실패하거나 아직 진행 중이어도 도시 카드를 표시한다.
  return (
    <DiscoverySections
      disabled={disabled}
      router={useRouter()}
      query={useQuery({
        queryKey: ['public', 'destination-discovery'],
        queryFn: loadDiscovery,
        staleTime: 1800000,
        retry: false,
      })}
    />
  );
}

// 도시 카드를 누르면 별도 상세 페이지로 이동한다.
function DiscoverySections({
  disabled,
  router,
  query,
}: {
  disabled: boolean;
  router: ReturnType<typeof useRouter>;
  query: ReturnType<typeof useQuery<DestinationDiscovery>>;
}) {
  // 카탈로그 도시마다 실제 사진이 있어 소개 API의 사진 누락에 영향을 받지 않는다.
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>
        {new Date().getMonth() + 1}월의 여행지
      </Text>
      <DiscoveryCarousel
        cities={monthlyCities(query.data)}
        blocked={disabled}
        name={(city) => {
          /* 도시의 한국어 이름을 읽는다. */ return guideDestination(city.key)!
            .city;
        }}
        onSelect={(city) => {
          /* 도시 키를 상세 경로에 전달한다. */ return router.push({
            pathname: '/destinations/[key]',
            params: { key: city.key },
          });
        }}
        renderCity={(city) => {
          // 앱에 포함한 사진과 출처를 카드에 표시한다.
          return (
            <>
              <CityGuidePhoto
                key={city.key}
                city={guideDestination(city.key)!}
                compact
              />
              <View style={s.cardCopy}>
                <Text style={s.caption}>
                  {guideDestination(city.key)!.country}
                </Text>
                <Text style={s.city}>{guideDestination(city.key)!.city}</Text>
                <Text style={s.supporting}>
                  {guideDestination(city.key)!.theme}
                </Text>
                <Text style={s.caption}>
                  사진: {cityPhotoCredit(city.key).author} ·{' '}
                  {cityPhotoCredit(city.key).license}
                </Text>
                <Text style={s.source}>도시 이야기와 여행 팁 보기 →</Text>
              </View>
            </>
          );
        }}
      />
    </View>
  );
}

// 월별 도시를 선택하고 외부 원문이 없으면 출처가 있는 편집 가이드를 제공한다.
function monthlyCities(data?: DestinationDiscovery): DiscoveryCity[] {
  // 소개 조회 상태와 관계없이 동일한 세 도시를 유지한다.
  return (ideas[new Date().getMonth()] || ideas[0]!).map((key) => {
    // 실제 외부 소개가 있는 도시만 원문을 추가로 사용할 수 있다.
    return (
      data?.cities.find((city) => {
        /* 같은 키의 소개만 읽는다. */ return city.key === key;
      }) || bundledDiscoveryCity(guideDestination(key)!)
    );
  });
}
