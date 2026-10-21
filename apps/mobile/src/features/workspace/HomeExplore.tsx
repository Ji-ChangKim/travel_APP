import Text from '@/components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { foundationQueryKey } from '@wherego/api-client';
import type { CommunityPost } from '@wherego/domain';
import { loadCommunity } from './communityService';
import CommunityPhoto from './CommunityPhoto';
import { travelDateRange } from './travelDateRange';
import { homeExploreStyles as s } from './homeExploreStyles';
import { homeColors as colors } from './homeTheme';
import { Action } from './ui';

// 실제 공개 여행만 도시별로 탐색하고 선택한 원본 게시물로 이동한다.
export default function HomeExplore({ userId }: { userId: string }) {
  // 인증 계정의 차단 설정과 조회 취소 경계를 기존 서비스에 맡긴다.
  const query = useQuery({
    queryKey: foundationQueryKey(userId || 'public', 'home-community'),
    queryFn: ({ signal }) => {
      // 정적인 인기 여행이나 저장 수를 실제 응답에 섞지 않는다.
      return loadCommunity(userId, 0, {}, signal);
    },
    retry: false,
  });
  const router = useRouter();
  return (
    <View style={s.section} testID="home-explore">
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          어디로 떠나볼까요?
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="공개 일정 더 둘러보기"
          style={s.more}
          onPress={() => {
            // 전체 공개 목록으로 이동한다.
            return router.push('/(tabs)/footprints');
          }}
        >
          <Text style={s.meta}>더보기</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={s.meta}>여행자들의 실제 일정에서 영감을 얻어보세요.</Text>
      {query.isPending ? (
        <Text style={s.meta}>공개 여행 불러오는 중…</Text>
      ) : query.isError ? (
        <View style={s.notice}>
          <Text style={s.meta}>다른 여행을 불러오지 못했어요.</Text>
          <Action
            label="공개 여행 다시 불러오기"
            onPress={() => {
              // 실패한 공개 여행 조회만 재시도한다.
              return void query.refetch();
            }}
          />
        </View>
      ) : query.data?.length ? (
        <ExploreTrips posts={query.data} />
      ) : (
        <View style={s.notice}>
          <Text style={s.meta}>
            아직 공개된 여행이 없어요. 나의 첫 여행을 계획해 보세요.
          </Text>
        </View>
      )}
    </View>
  );
}

// 서버가 반환한 공개 도시를 필터로 만들고 최대 세 개의 카드를 보여준다.
function ExploreTrips({ posts }: { posts: CommunityPost[] }) {
  // 조회 결과가 바뀌어 선택한 도시가 사라지면 전체 목록을 표시한다.
  const [city, setCity] = useState<string | null>(null);
  const cities = [
    ...new Set(
      posts
        .map((post) => {
          // 빈 도시 이름은 검색 선택지로 만들지 않는다.
          return post.snapshot.city.trim();
        })
        .filter(Boolean),
    ),
  ];
  const selected = city && cities.includes(city) ? city : null;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {[null, ...cities].map((item) => {
          // 선택된 도시의 상태를 화면과 보조 기술에 함께 전달한다.
          return (
            <Pressable
              key={item ?? 'all'}
              accessibilityRole="button"
              accessibilityLabel={`공개 여행 ${item ?? '전체'}`}
              accessibilityState={{ selected: selected === item }}
              aria-selected={selected === item}
              onPress={() => {
                // 공개 목록 안에서만 도시 필터를 바꾼다.
                return setCity(item);
              }}
              style={[s.chip, selected === item && s.selectedChip]}
            >
              <Text
                style={[s.chipText, selected === item && s.selectedChipText]}
              >
                {item ?? '전체'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {posts
        .filter((post) => {
          // 도시를 선택하지 않으면 공개된 모든 여행을 후보로 유지한다.
          return !selected || post.snapshot.city.trim() === selected;
        })
        .slice(0, 3)
        .map((post) => {
          // 원본 게시물 ID로 카드와 이동 대상을 일치시킨다.
          return <ExploreCard key={post.id} post={post} />;
        })}
    </>
  );
}

// 사진과 기간·작성자를 공개 원본에서만 가져오는 일정 카드를 그린다.
function ExploreCard({ post }: { post: CommunityPost }) {
  // 사진이 없으면 다른 도시 사진을 대신 쓰지 않고 가방 모티프를 표시한다.
  const router = useRouter();
  return (
    <View style={s.card}>
      <View style={s.cover}>
        {post.photoPaths[0] ? (
          <CommunityPhoto path={post.photoPaths[0]} coverHeight={144} />
        ) : (
          <View style={s.placeholder}>
            <Ionicons name="map-outline" size={40} color={colors.accent} />
          </View>
        )}
      </View>
      <View style={s.cardCopy}>
        <Text style={s.location}>
          {[post.snapshot.country, post.snapshot.city]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text accessibilityRole="header" style={s.cardTitle}>
          {post.title}
        </Text>
        <Text style={s.meta}>
          {travelDateRange(post.snapshot.startDate, post.snapshot.endDate)}
        </Text>
      </View>
      <View style={s.footer}>
        <Text style={[s.meta, s.author]}>{post.author}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.title} 공개 일정 보기`}
          style={s.open}
          onPress={() => {
            // 공개 선택 범위를 보존하는 기존 상세 진입 경로를 사용한다.
            return router.push({
              pathname: '/(tabs)/community',
              params: { postId: post.id },
            });
          }}
        >
          <Text style={s.openText}>일정 구경하기</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}
