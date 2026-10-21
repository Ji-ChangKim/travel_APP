import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey } from '@wherego/api-client';
import { useRouter, useIsFocused } from 'expo-router';
import Text from '@/components/AppText';
import type { CommunityPost } from '@wherego/domain';
import MyTripsButton from './MyTripsButton';
import CommunityPhoto from './CommunityPhoto';
import CommunityImportButton from './CommunityImportButton';
import { loadCommunity } from './communityService';
import { communityFeedPeriod } from './communityFeedCard';
import { myTripsStyles as s, myTripsColors as c } from './myTripsStyles';

// 개인 여행이 실제로 비어 있을 때만 첫 여행과 실제 공개 일정을 안내한다.
export default function MyTripsEmpty({ userId }: { userId: string }) {
  // 시안의 가방 모티프는 빈 상태 장식이며 가상 여행 표지가 아니다.
  const router = useRouter();
  return (
    <View style={s.section} testID="my-trips-empty">
      <View style={s.empty}>
        <View accessible={false} style={s.emptyArt}>
          <View style={s.notebook}>
            <Ionicons name="briefcase" size={36} color={c.primary} />
            <View style={s.artAdd}>
              <Ionicons name="add" size={18} color={c.card} />
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={[s.headingTitle, s.centered]}>
          아직 등록된 여행이 없어요
        </Text>
        <Text style={[s.body, s.centered]}>
          새로운 여행을 계획하거나, 다른 여행자의 발자국 일정을 참고해 나만의
          여행을 시작해 보세요.
        </Text>
      </View>
      <View style={s.createCard}>
        <View style={s.row}>
          <View style={[s.heading, s.flex]}>
            <View style={s.createBadge}>
              <Text style={s.strongCaption}>추천 시작</Text>
            </View>
            <Text accessibilityRole="header" style={s.title}>
              새 여행 계획 만들기
            </Text>
            <Text style={s.body}>
              목적지와 일정을 선택하고 나만의 여행 코스를 짜보세요.
            </Text>
          </View>
          <View style={s.createIcon}>
            <Ionicons name="map-outline" size={26} color={c.primary} />
          </View>
        </View>
        <MyTripsButton
          label="새 여행 계획 만들기"
          onPress={() => {
            /* 기존 목적지·날짜 입력 화면으로 이동한다. */ return router.push(
              '/new-trip',
            );
          }}
          style={[s.action, s.primary]}
        >
          <Ionicons name="add" size={20} color={c.card} />
          <Text style={[s.actionText, s.inverse]}>새 여행 계획 만들기</Text>
        </MyTripsButton>
      </View>
      <MyTripsInspiration userId={userId} />
      <View style={s.help}>
        <View style={s.row}>
          <Ionicons name="bulb-outline" size={22} color={c.primary} />
          <Text style={s.title}>여행 시작이 막막하신가요?</Text>
        </View>
        <Text style={s.body}>
          발자국에서 다른 여행자의 동선을 살펴보세요. 가고 싶은 장소를 참고해 새
          여행 계획을 만들어 보세요.
        </Text>
      </View>
    </View>
  );
}

// 비어 있는 추천 목록을 시안의 예제 도시·사진·인기 수치로 채우지 않는다.
function MyTripsInspiration({ userId }: { userId: string }) {
  // 홈·발자국과 같은 공개 응답과 차단 규칙을 사용한다.
  const focused = useIsFocused();
  const router = useRouter();
  const query = useQuery({
    queryKey: foundationQueryKey(userId || 'public', 'home-community'),
    enabled: focused,
    retry: false,
    queryFn: ({ signal }) => {
      /* 실제 공개된 글만 읽는다. */ return loadCommunity(
        userId,
        0,
        {},
        signal,
      );
    },
  });
  return (
    <View style={s.section} testID="my-trips-inspiration">
      <View style={s.wrapRow}>
        <View style={s.heading}>
          <Text style={s.strongCaption}>공개 일정</Text>
          <Text accessibilityRole="header" style={s.title}>
            다른 여행자의 발자국 둘러보기
          </Text>
        </View>
        <MyTripsButton
          label="발자국 더보기"
          style={s.iconButton}
          onPress={() => {
            /* 별도 예제 목록 없이 기존 공개 화면을 연다. */ return router.push(
              '/(tabs)/footprints',
            );
          }}
        >
          <Text style={s.strongCaption}>더보기 ›</Text>
        </MyTripsButton>
      </View>
      {query.isPending ? (
        <Text style={s.body}>공개된 일정을 불러오는 중이에요.</Text>
      ) : query.isError ? (
        <View style={s.panel}>
          <Text style={s.body}>공개된 일정을 불러오지 못했어요.</Text>
          <MyTripsButton
            label="공개 일정 다시 불러오기"
            style={s.action}
            onPress={() => {
              /* 실패한 공개 조회만 다시 시도한다. */ return void query.refetch();
            }}
          >
            <Text style={s.actionText}>다시 불러오기</Text>
          </MyTripsButton>
        </View>
      ) : query.data?.length ? (
        query.data
          .slice(0, 2)
          .map((post) => <InspirationCard key={post.id} post={post} />)
      ) : (
        <Text style={s.body}>
          아직 공개된 일정이 없어요. 나만의 여행부터 시작해 보세요.
        </Text>
      )}
    </View>
  );
}

// 실제 게시물의 표지·장소 수·기간만 작은 추천 카드로 표시한다.
function InspirationCard({ post }: { post: CommunityPost }) {
  // 실제 담기와 원본 상세 보기를 각각 제공한다.
  const router = useRouter();
  return (
    <View style={s.inspiration} testID={`my-trip-inspiration-${post.id}`}>
      <View style={s.row}>
        <View style={s.thumbnail}>
          {post.photoPaths[0] ? (
            <CommunityPhoto
              path={post.photoPaths[0]}
              coverHeight={80}
              edgeToEdge
            />
          ) : (
            <Ionicons name="map-outline" size={28} color={c.muted} />
          )}
        </View>
        <View style={[s.heading, s.flex]}>
          <Text style={s.caption}>
            {[post.snapshot.country, post.snapshot.city]
              .filter(Boolean)
              .join(' · ')}{' '}
            · {communityFeedPeriod(post.snapshot)}
          </Text>
          <Text style={s.caption}>
            장소{' '}
            {
              post.snapshot.itinerary.filter((item) => item.type === 'PLACE')
                .length
            }
            곳
          </Text>
          <Text style={[s.body, { color: c.ink, fontWeight: '700' }]}>
            {post.title}
          </Text>
        </View>
      </View>
      <MyTripsButton
        label={`${post.title} 공개 일정 보기`}
        style={s.action}
        onPress={() => {
          /* 새 여행을 만들거나 공개 상태를 바꾸지 않는다. */ return router.push(
            `/community/${post.id}`,
          );
        }}
      >
        <Ionicons name="map-outline" size={16} color={c.primary} />
        <Text style={s.strongCaption}>발자국 일정 보기</Text>
      </MyTripsButton>
      <CommunityImportButton postId={post.id} />
    </View>
  );
}
