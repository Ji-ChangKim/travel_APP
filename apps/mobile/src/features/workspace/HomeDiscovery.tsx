import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  discoveryDestinations,
  type DiscoveryDestination,
} from '@wherego/domain';
import type { DiscoveryCity, DestinationDiscovery } from '@wherego/validation';
import Modal from '@/components/AppModal';
import { loadDiscovery } from './discoveryService';
import { discoveryStyles as s } from './discoveryStyles';
import { Action } from './ui';
import DiscoveryCarousel from './DiscoveryCarousel';

type CityKey = DiscoveryDestination['key'];
type LocalState<T> = [T, Dispatch<SetStateAction<T>>];
interface Props {
  disabled: boolean;
  onPlan: (key: CityKey) => void;
}
// 월별 여행 아이디어는 편집 선정이며 실제 여행객 순위로 사용하지 않는다.
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

// 첫 메인에서 여행지 탐색을 여행 생성보다 먼저 제공한다.
export default function HomeDiscovery(props: Props) {
  // 공용 조회 키에 사용자나 세션을 포함하지 않는다.
  return (
    <DiscoveryContent
      {...props}
      query={useQuery({
        queryKey: ['public', 'destination-discovery'],
        queryFn: loadDiscovery,
        staleTime: 1800000,
        retry: false,
      })}
    />
  );
}

// API 결과와 선택한 도시 상세의 수명만 관리한다.
function DiscoveryContent({
  query,
  ...props
}: Props & { query: ReturnType<typeof useQuery<DestinationDiscovery>> }) {
  // 도시 선택 전에는 다른 사용자의 여행 데이터를 만들지 않는다.
  return (
    <DiscoverySections
      {...props}
      query={query}
      selection={useState<DiscoveryCity | null>(null)}
    />
  );
}

// 소개 로딩·오류·실제 콘텐츠를 같은 위치에서 제공한다.
function DiscoverySections({
  query,
  selection,
  ...props
}: Props & {
  query: ReturnType<typeof useQuery<DestinationDiscovery>>;
  selection: LocalState<DiscoveryCity | null>;
}) {
  // 콘텐츠가 없을 때 가상의 인기 순위로 화면을 채우지 않는다.
  return (
    <View style={s.section}>
      <Text style={s.eyebrow}>여행의 시작은 새로운 발견</Text>
      <Text style={s.headline}>
        {new Date().getMonth() + 1}월, 어디로 떠날까요?
      </Text>
      <Text style={s.supporting}>
        도시의 이야기를 살펴보고, 마음에 드는 곳을 골라보세요.
      </Text>
      {query.isPending ? (
        <Text style={s.supporting}>여행지를 둘러볼 준비를 하고 있어요.</Text>
      ) : query.data ? (
        <>
          {query.isError && (
            <Text style={s.supporting}>
              새 정보를 가져오지 못했어요. 마지막으로 불러온 여행지를
              보여드려요.
            </Text>
          )}
          <Text style={s.title}>이달의 여행 아이디어</Text>
          <Text style={s.caption}>
            TripPrint 편집 선정 · 도시 소개는 위키백과에서 제공해요.
          </Text>
          <CityCards
            cities={monthlyCities(query.data)}
            onSelect={selection[1]}
            blocked={selection[0] !== null}
          />
          <ReadTrends data={query.data} onSelect={selection[1]} />
          <Action
            label="여행지 정보 새로고침"
            onPress={() => {
              // 외부 소개와 집계가 실패했을 때 같은 공개 조회를 다시 실행한다.
              return void query.refetch();
            }}
          />
        </>
      ) : (
        <>
          <Text style={s.supporting}>
            여행지를 불러오지 못했어요. 연결을 확인하고 다시 둘러보세요.
          </Text>
          <Action
            label="여행지 다시 불러오기"
            onPress={() => {
              // 개인 여행 저장 상태와 독립적으로 소개만 재시도한다.
              return void query.refetch();
            }}
          />
        </>
      )}
      {selection[0] && (
        <CityDetail
          city={selection[0]}
          {...props}
          onClose={() => {
            // 상세를 닫아도 탐색 위치와 조회 결과를 유지한다.
            return selection[1](null);
          }}
        />
      )}
    </View>
  );
}

// 편집 선정 순서대로 이번 달에 실제 응답한 도시만 고른다.
function monthlyCities(data: DestinationDiscovery): DiscoveryCity[] {
  // 소개가 누락된 도시는 다음 실제 도시로 보충한다.
  return [
    ...new Set([
      ...(ideas[new Date().getMonth()] || []),
      ...data.cities.map((city) => {
        // API에서 검증한 키만 후보에 추가한다.
        return city.key;
      }),
    ]),
  ]
    .flatMap((key) => {
      // 다른 월의 추천이라고 임의 원문을 만들지 않는다.
      return data.cities.filter((city) => {
        // 편집 목록과 실제 응답 문서를 대응시킨다.
        return city.key === key;
      });
    })
    .slice(0, 3);
}

// 국가와 통화 등의 고정 표시 정보는 공통 카탈로그에서 읽는다.
function destination(key: CityKey): DiscoveryDestination {
  // 외부 데이터와 생성 폼이 서로 다른 국가를 가리키지 않게 한다.
  return discoveryDestinations.find((city) => {
    // 검증 계약이 이미 제한한 키 하나만 찾는다.
    return city.key === key;
  })!;
}

// 여행 사진과 테마를 가로 카드로 탐색한다.
function CityCards({
  cities,
  onSelect,
  blocked,
}: {
  cities: DiscoveryCity[];
  onSelect: (city: DiscoveryCity) => void;
  blocked: boolean;
}) {
  // 순위를 암시하는 번호 없이 편집 선정 도시를 제공한다.
  return (
    <DiscoveryCarousel
      cities={cities}
      blocked={blocked}
      onSelect={onSelect}
      name={(city) => {
        // 공통 카탈로그의 도시 이름을 조작 안내에도 사용한다.
        return destination(city.key).city;
      }}
      renderCity={(city) => {
        // 사진과 소개만 카드 내용으로 넘겨 타이머 상태와 분리한다.
        return (
          <>
            <CityImage city={city} />
            <View style={s.cardCopy}>
              <Text style={s.caption}>{destination(city.key).country}</Text>
              <Text style={s.city}>{destination(city.key).city}</Text>
              <Text style={s.supporting}>{destination(city.key).theme}</Text>
              {city.image && (
                <Text style={s.caption} numberOfLines={2}>
                  사진: {city.image.author} · {city.image.license}
                </Text>
              )}
            </View>
          </>
        );
      }}
    />
  );
}

// 사진 로드 오류에서는 도시 이름을 대체 표시한다.
function CityImage({ city }: { city: DiscoveryCity }) {
  // 네트워크 오류 이미지를 계속 재요청하지 않는다.
  return <CityImageContent city={city} failure={useState(false)} />;
}

// 허가된 원본 사진이 없는 도시도 빈 이미지로 보이지 않게 한다.
function CityImageContent({
  city,
  failure,
}: {
  city: DiscoveryCity;
  failure: LocalState<boolean>;
}) {
  // 다른 도시의 사진이나 생성 사진으로 원본을 대체하지 않는다.
  return city.image && !failure[0] ? (
    <Image
      accessibilityLabel={`${destination(city.key).city} · 사진 ${city.image.author}`}
      source={{ uri: city.image.url }}
      style={s.photo}
      resizeMode="cover"
      onError={() => {
        // 사진만 실패해도 도시 소개와 여행 생성은 계속 제공한다.
        return failure[1](true);
      }}
    />
  ) : (
    <View style={[s.photo, s.placeholder]}>
      <Text style={s.city}>{destination(city.key).city}</Text>
    </View>
  );
}

// 읽기 통계의 범위와 실제 여행객 수의 차이를 설명한다.
function ReadTrends({
  data,
  onSelect,
}: {
  data: DestinationDiscovery;
  onSelect: (city: DiscoveryCity) => void;
}) {
  // 일부 도시 통계가 누락되면 남은 도시만으로 순위를 만들지 않는다.
  return data.statisticsAvailable ? (
    <View style={s.section}>
      <Text style={s.title}>위키백과에서 많이 읽힌 도시 TOP 3</Text>
      <Text style={s.caption}>
        {data.period} · 한국어 위키백과 · 선정한 {discoveryDestinations.length}
        개 도시 비교{`\n`}문서 조회 수이며 실제 여행객 수나 예약 순위가
        아니에요.
      </Text>
      <TrendRows
        keys={data.mostRead}
        data={data}
        onSelect={onSelect}
        rising={false}
      />
      {data.rising.length > 0 && (
        <>
          <Text style={s.title}>지난달보다 더 많이 읽힌 도시</Text>
          <Text style={s.caption}>
            {data.previousPeriod} 대비 {data.period} 문서 조회 증가율 · 이전 달
            100회 이상
          </Text>
          <TrendRows
            keys={data.rising}
            data={data}
            onSelect={onSelect}
            rising
          />
        </>
      )}
      <Text style={s.caption}>
        Wikimedia Analytics · 불러온 날 {data.fetchedAt.slice(0, 10)}
      </Text>
    </View>
  ) : (
    <Text style={s.supporting}>
      도시 조회 통계를 불러오지 못했어요. 여행지 정보 새로고침으로 다시 확인해
      주세요.
    </Text>
  );
}

// 동일 응답의 도시만 조회 수·증가율과 함께 연결한다.
function TrendRows({
  keys,
  data,
  onSelect,
  rising,
}: {
  keys: CityKey[];
  data: DestinationDiscovery;
  onSelect: (city: DiscoveryCity) => void;
  rising: boolean;
}) {
  // 실제 조회 버킷이 있는 도시만 사용자에게 표시한다.
  return (
    <View>
      {keys.map((key, index) => {
        // API 키와 상세 원문의 일치 여부를 다시 확인한다.
        return (
          <TrendCity
            key={key}
            city={data.cities.find((city) => {
              // 같은 데이터에 있는 문서만 연다.
              return city.key === key;
            })!}
            rank={index + 1}
            rising={rising}
            onSelect={onSelect}
          />
        );
      })}
    </View>
  );
}

// 통계 값 하나와 도시 상세 이동을 한 줄로 제공한다.
function TrendCity({
  city,
  rank,
  rising,
  onSelect,
}: {
  city: DiscoveryCity;
  rank: number;
  rising: boolean;
  onSelect: (city: DiscoveryCity) => void;
}) {
  // 제목과 달리 방문객 수로 오해할 수 있는 명수 단위는 사용하지 않는다.
  return (
    <Pressable
      style={s.trend}
      accessibilityRole="button"
      accessibilityLabel={`${destination(city.key).city} 조회 통계와 소개`}
      onPress={() => {
        // 인기와 증가율 어느 목록에서도 동일한 원문을 연다.
        return onSelect(city);
      }}
    >
      <Text style={s.rank}>{rank}</Text>
      <View style={s.trendCopy}>
        <Text style={s.city}>{destination(city.key).city}</Text>
        <Text style={s.caption}>{destination(city.key).country}</Text>
      </View>
      <Text style={s.metric}>
        {rising
          ? `+${((city.currentViews! / city.previousViews! - 1) * 100).toFixed(1)}%`
          : `${city.currentViews!.toLocaleString('ko-KR')}회`}
      </Text>
    </Pressable>
  );
}

// 원문 소개와 사진 출처를 확인하고 같은 도시의 계획으로 이어간다.
function CityDetail({
  city,
  onClose,
  onPlan,
  disabled,
}: Props & { city: DiscoveryCity; onClose: () => void }) {
  // 상세 화면에서는 링크 실패 안내만 별도 상태로 관리한다.
  return (
    <CityDetailContent
      city={city}
      onClose={onClose}
      onPlan={onPlan}
      disabled={disabled}
      linkError={useState('')}
    />
  );
}

// 외부 링크 실패 시 닫기와 여행 계획 행동을 유지한다.
function CityDetailContent({
  city,
  onClose,
  onPlan,
  disabled,
  linkError,
}: Props & {
  city: DiscoveryCity;
  onClose: () => void;
  linkError: LocalState<string>;
}) {
  // 소개 본문과 저작자 정보는 HTML 없이 일반 텍스트로 표시한다.
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView contentContainerStyle={s.detail}>
            <CityImage city={city} />
            <Text style={s.caption}>{destination(city.key).country}</Text>
            <Text style={s.headline}>{destination(city.key).city}</Text>
            <Text style={s.supporting}>{city.excerpt}</Text>
            <SourceLink
              label="소개 원문 · 위키백과 기여자"
              url={city.sourceUrl}
              error={linkError[1]}
            />
            <SourceLink
              label="소개 일부 발췌 · CC BY-SA 4.0"
              url="https://creativecommons.org/licenses/by-sa/4.0/"
              error={linkError[1]}
            />
            {city.image && (
              <>
                <SourceLink
                  label={`사진: ${city.image.author} · Wikimedia Commons`}
                  url={city.image.sourceUrl}
                  error={linkError[1]}
                />
                <SourceLink
                  label={`사진 라이선스: ${city.image.license}`}
                  url={city.image.licenseUrl}
                  error={linkError[1]}
                />
              </>
            )}
            {linkError[0] ? (
              <Text style={s.supporting}>{linkError[0]}</Text>
            ) : null}
            <Action
              label={`${destination(city.key).city} 여행 계획하기`}
              disabled={disabled}
              onPress={() => {
                // 실제 생성 경로에 검증한 목적지 키만 전달한다.
                return (onClose(), onPlan(city.key));
              }}
            />
            <Action label="여행지 상세 닫기" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 검증된 출처와 이용 조건을 외부 브라우저에서 확인한다.
function SourceLink({
  label,
  url,
  error,
}: {
  label: string;
  url: string;
  error: (message: string) => void;
}) {
  // 외부 링크 실패는 화면을 종료하거나 성공으로 표시하지 않는다.
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        // 외부 링크 주소는 API 계약의 HTTPS 허용 목록을 이미 통과했다.
        return void Linking.openURL(url).catch(() => {
          // 원본 오류 대신 다시 시도할 수 있는 안내를 표시한다.
          return error(
            '링크를 열지 못했어요. 연결을 확인하고 다시 눌러 주세요.',
          );
        });
      }}
    >
      <Text style={s.source}>{label}</Text>
    </Pressable>
  );
}
