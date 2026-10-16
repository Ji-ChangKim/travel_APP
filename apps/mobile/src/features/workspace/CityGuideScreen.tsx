import Modal from '@/components/AppModal';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
  useIsFocused,
} from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTripStore } from '@/stores/useTripStore';
import {
  cityGuides,
  cityPhotoCredit,
  guideDestination,
  type CityGuide,
} from './cityGuides';
import { discoveryStyles as s } from './discoveryStyles';
import { Action, styles } from './ui';
import { loadDiscovery } from './discoveryService';
import CityGuidePhoto from './CityGuidePhoto';
import CitySourcesModal from './CitySourcesModal';
import { matchingCityStory } from './cityGuideSources';
import type { DiscoveryDestination } from '@wherego/domain';

// 도시 상세를 홈의 작은 팝업 대신 독립된 페이지에서 읽는다.
export default function CityGuideScreen() {
  // 직접 링크 진입에서도 검증한 도시와 공개 소개만 읽는다.
  return (
    <GuideContent
      cityKey={useLocalSearchParams<{ key: string }>().key}
      router={useRouter()}
      userId={useTripStore((state) => {
        /* 현재 계정 여부만 읽는다. */ return state.currentUser?.id;
      })}
      query={useQuery({
        queryKey: ['public', 'destination-discovery'],
        queryFn: loadDiscovery,
        staleTime: 1800000,
        retry: false,
      })}
    />
  );
}

// 선택한 도시에서 같은 목적지의 여행 생성으로 이어간다.
function planCity(
  router: ReturnType<typeof useRouter>,
  key: string,
  userId?: string,
): void {
  // 로그인하지 않았다면 인증 이후에도 선택한 도시를 보존한다.
  return router.push(
    userId
      ? { pathname: '/new-trip', params: { destination: key } }
      : { pathname: '/login', params: { next: 'new-trip', destination: key } },
  );
}

// 직접 진입 시에도 홈으로 돌아갈 수 있게 한다.
function closeGuide(router: ReturnType<typeof useRouter>): void {
  // 앱 내 이전 화면이 있으면 탐색 위치를 보존한다.
  return router.canGoBack() ? router.back() : router.replace('/(tabs)');
}

// 관광 정보와 사진 출처를 스크롤 가능한 전체 페이지로 제공한다.
function GuideContent(
  {
    cityKey,
    router,
    userId,
    query,
  }: {
    cityKey: string;
    router: ReturnType<typeof useRouter>;
    userId?: string;
    query: ReturnType<
      typeof useQuery<Awaited<ReturnType<typeof loadDiscovery>>>
    >;
  },
  city = guideDestination(cityKey),
) {
  // 알 수 없는 경로에서는 다른 도시의 가이드를 보여주지 않는다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader
        title={city ? `${city.city} 여행 가이드` : '여행지 안내'}
        backLabel="여행지 목록으로 돌아가기"
        onBack={() => {
          // 기존 도시 가이드의 복귀 경로를 유지한다.
          return closeGuide(router);
        }}
      />
      {city ? (
        <GuideBody
          key={city.key}
          city={city}
          router={router}
          userId={userId}
          query={query}
        />
      ) : (
        <View style={styles.content}>
          <Text style={s.supporting}>
            찾는 여행지가 없어요. 목록으로 돌아가 다른 도시를 선택해 주세요.
          </Text>
          <Action
            label="여행지 목록으로 돌아가기"
            onPress={() => {
              /* 잘못된 주소에서 홈으로 이동한다. */ return router.replace(
                '/(tabs)',
              );
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// 명소와 먹거리를 각 항목의 짧은 설명과 함께 표시한다.
function GuideItems({
  title,
  items,
}: {
  title: string;
  items: CityGuide['places'];
}) {
  // 항목 목록은 선택 도시의 편집 가이드만 사용한다.
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      {items.map((item) => {
        // 이름과 여행에 도움이 되는 설명을 함께 표시한다.
        return (
          <View key={item.title} style={{ gap: 6 }}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={s.supporting}>{item.description}</Text>
          </View>
        );
      })}
    </View>
  );
}

// 현재 도시의 읽기 상태와 출처 모달 수명을 독립적으로 관리한다.
function GuideBody({
  city,
  router,
  userId,
  query,
}: {
  city: DiscoveryDestination;
  router: ReturnType<typeof useRouter>;
  userId?: string;
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof loadDiscovery>>>>;
}) {
  // 새 도시에서는 모달·사진 오류가 이전 도시에서 이어지지 않는다.
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // 탐색 화면이 뒤에 남아 있어도 출처 창은 현재 화면에만 표시한다.
  const focused = useIsFocused();
  // 화면을 떠나면 출처 읽기 상태도 닫는다.
  useFocusEffect(
    useCallback(() => {
      // 외부 브라우저 복귀는 같은 경로를 유지하고 앱 내 화면 이탈만 정리한다.
      return () => {
        // 다른 목적지나 탭에 이전 도시의 출처가 겹치지 않는다.
        setSourcesOpen(false);
      };
    }, []),
  );
  // 실제 원문 문서까지 일치하는 추가 소개만 읽는다.
  const story = matchingCityStory(city, query.data);
  // 가이드 스크롤은 모달을 열고 닫아도 그대로 유지한다.
  return (
    <>
      <ScrollView
        testID="city-guide-content"
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
      >
        <CityGuidePhoto key={city.key} city={city} />
        <Text style={s.caption}>{cityGuides[city.key].photoDescription}</Text>
        <View style={{ gap: 8 }}>
          <Text style={s.caption}>{city.country}</Text>
          <Text accessibilityRole="header" style={s.headline}>
            {city.city}
          </Text>
          <Text style={s.supporting}>{cityGuides[city.key].intro}</Text>
        </View>
        <GuideItems
          title="추천 여행지·관광지"
          items={cityGuides[city.key].places}
        />
        <GuideItems title="추천 먹거리" items={cityGuides[city.key].foods} />
        <View style={styles.card}>
          <Text accessibilityRole="header" style={s.title}>
            언제 가면 좋을까요?
          </Text>
          {cityGuides[city.key].seasons.map((season) => {
            // 계절의 일반적인 볼거리를 월 범위와 함께 표시한다.
            return (
              <View key={season.months} style={{ gap: 6 }}>
                <Text style={styles.label}>{season.months}</Text>
                <Text style={s.supporting}>{season.description}</Text>
              </View>
            );
          })}
          <Text style={s.caption}>
            꽃과 단풍 시기는 해마다 달라요. 행사 날짜와 운영 시간은 여행 전에
            공식 안내에서 확인해 주세요.
          </Text>
        </View>
        <Action
          variant="primary"
          label={`${city.city} 여행 계획하기`}
          onPress={() => {
            /* 현재 도시로 여행 생성을 시작한다. */ return planCity(
              router,
              city.key,
              userId,
            );
          }}
        />
        {story && (
          <View style={styles.card}>
            <Text style={s.title}>도시 이야기</Text>
            <Text style={s.supporting}>{story.excerpt}</Text>
            <Text style={s.caption}>
              한국어 위키백과 기여자 · CC BY-SA 4.0 · 소개 일부 발췌
            </Text>
          </View>
        )}
        <View style={{ gap: 6 }}>
          <Text style={s.title}>여행 정보·사진 출처</Text>
          <Text style={s.caption}>
            사진: {cityPhotoCredit(city.key).author} ·{' '}
            {cityPhotoCredit(city.key).license}
          </Text>
          <Action
            label="정보·사진 출처 보기"
            onPress={() => {
              // 외부 이동 없이 현재 도시의 출처부터 읽는다.
              return setSourcesOpen(true);
            }}
          />
        </View>
      </ScrollView>
      <Modal
        native
        transparent
        visible={sourcesOpen && focused}
        accessibilityLabel={`${city.city} 정보·사진 출처`}
        onRequestClose={() => {
          // 원문 창만 닫고 가이드의 읽던 위치를 유지한다.
          setSourcesOpen(false);
        }}
      >
        {sourcesOpen && focused && (
          <CitySourcesModal
            city={city}
            sources={cityGuides[city.key].sources}
            story={story}
            onClose={() => {
              // 출처만 닫고 도시 가이드의 읽던 위치로 돌아간다.
              return setSourcesOpen(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}
