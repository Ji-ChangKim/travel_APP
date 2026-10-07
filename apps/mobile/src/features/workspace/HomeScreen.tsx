import HaruState from '@/components/HaruState';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { listServerTrips } from '@wherego/api-client';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { Action } from './ui';
import { homeDestinations } from './homeDestinations';
import HomeTripList, { continuingTrips } from './HomeTripList';
import { homeStyles as s } from './homeStyles';
import HomeExplore from './HomeExplore';

interface HomeProps {
  userId: string;
  trips: Awaited<ReturnType<typeof listServerTrips>> | undefined;
  loading: boolean;
  error: string;
  onReload: () => void;
}

// 첫 방문과 재방문의 목적에 맞는 홈 콘텐츠를 연결한다.
export default function HomeScreen(props: HomeProps) {
  // 인증 확인 전에는 처음 온 사용자로 단정하지 않는다.
  return (
    <HomeContent
      {...props}
      router={useRouter()}
      ready={useAuthReady((state) => {
        // 실제 인증 초기화가 끝났는지만 읽는다.
        return state.ready;
      })}
    />
  );
}

// 목적지를 누르면 중간 선택 화면 없이 여행 생성 또는 로그인으로 이동한다.
function startTrip(
  router: ReturnType<typeof useRouter>,
  userId: string,
  destination = '',
): void {
  // 인증 후에도 선택한 목적지를 같은 생성 폼으로 전달한다.
  return router.push(
    userId
      ? destination
        ? { pathname: '/new-trip', params: { destination } }
        : '/new-trip'
      : {
          pathname: '/login',
          params: { next: 'new-trip', ...(destination ? { destination } : {}) },
        },
  );
}

// 홈의 주 행동과 실제 내 여행을 먼저 배치한다.
function HomeContent({
  userId,
  trips,
  loading,
  error,
  onReload,
  router,
  ready,
}: HomeProps & {
  router: ReturnType<typeof useRouter>;
  ready: boolean;
}) {
  // 안내용 가상 일정 대신 실제 여행과 작동하는 이동 경로만 제공한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.topBar}>
          <Image
            source={require('../../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
            style={s.logo}
            resizeMode="contain"
            accessibilityLabel="TripPrint 트립프린트"
          />
          {!userId && ready && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="로그인"
              style={s.login}
              onPress={() => {
                // 내 여행을 저장하기 위한 로그인 화면을 연다.
                return router.push('/login');
              }}
            >
              <Text style={s.linkText}>로그인</Text>
            </Pressable>
          )}
        </View>
        <View style={s.section}>
          <Text style={s.headline}>다음 여행을 계획해 볼까요?</Text>
          <Text style={s.supporting}>
            새 일정을 만들고, 다가오는 여행과 다른 여행자의 발자국을 확인하세요.
          </Text>
          <HomeButton
            label="새 일정 만들기"
            onPress={() => {
              // 로그인 또는 게스트 선택을 마친 뒤 새 여행을 작성한다.
              return startTrip(router, userId);
            }}
          />
        </View>
        {!ready || loading ? (
          <HaruState
            kind="loading"
            title="내 여행을 확인하고 있어요."
            compact
          />
        ) : error ? (
          <HaruState
            kind="error"
            title="내 여행을 불러오지 못했어요"
            description={error}
          >
            <Action label="내 여행 다시 불러오기" onPress={onReload} />
          </HaruState>
        ) : continuingTrips(trips).length > 0 ? (
          <HomeTripList trips={continuingTrips(trips)} router={router} />
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>다가오는 나의 여행</Text>
            <Text style={s.supporting}>
              예정된 여행이 아직 없어요. 새 일정을 만들고 날짜와 도시를 골라
              보세요.
            </Text>
          </View>
        )}
        <HomeExplore userId={userId} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>어디로 떠나고 싶나요?</Text>
          <Text style={s.supporting}>
            도시를 고르면 여행 계획을 바로 시작해요.
          </Text>
          <View style={s.destinations}>
            {homeDestinations.map((destination) => (
              /* 도시 선택은 실제 생성 경로로 한 번에 이어진다. */
              <Pressable
                key={destination.key}
                accessibilityRole="button"
                accessibilityLabel={`${destination.city} 선택`}
                disabled={!ready || loading}
                accessibilityState={{ disabled: !ready || loading }}
                style={s.destination}
                onPress={() => {
                  // 나라·도시·통화의 검증된 기본값을 생성 폼으로 넘긴다.
                  return startTrip(router, userId, destination.key);
                }}
              >
                <Text style={s.destinationText}>{destination.city}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <HomeLink
          label="초대 링크로 참여"
          detail="친구가 만든 여행에 함께해요"
          icon="people-outline"
          onPress={() => {
            // 받은 초대 링크의 확인 화면을 연다.
            return router.push('/invite');
          }}
        />
        {trips?.some((trip) => {
          // 완료한 여행이 있을 때만 기록 바로가기를 표시한다.
          return trip.status === 'COMPLETED';
        }) && (
          <HomeLink
            label="완성된 발자국 보기"
            detail="다녀온 여행을 다시 펼쳐보세요"
            icon="footsteps-outline"
            onPress={() => {
              // 실제 내 다이어리 목록을 연다.
              return router.push('/(tabs)/footprints');
            }}
          />
        )}
        {trips
          ?.filter((trip) => {
            // 보관한 여행은 재개 목록과 구분한다.
            return trip.status === 'ARCHIVED';
          })
          .map((trip) => (
            /* 보관된 여행에도 기존 읽기 경로를 제공한다. */
            <HomeLink
              key={trip.id}
              label="보관 여행 열기"
              detail={trip.title}
              icon="archive-outline"
              onPress={() => {
                // 보관 상태의 실제 여행 ID로 이동한다.
                return router.push(`/trips/${trip.id}`);
              }}
            />
          ))}
        <HomeLink
          label="Google Maps 장소 가져오기"
          detail="저장해 둔 장소의 공유 링크를 가져오세요"
          icon="map-outline"
          onPress={() => {
            // 실제 지원하는 단일 장소 공유 링크 입력 도구를 연다.
            return router.push('/import-place');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// 홈의 주 행동 버튼은 넓은 터치 영역과 명확한 이동 방향을 갖는다.
function HomeButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  // 보조 행동은 주 행동과 같은 강조색을 반복하지 않는다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => {
        // 터치 중에는 실행 가능한 버튼의 반응을 표현한다.
        return [
          s.startButton,
          secondary && s.secondaryButton,
          pressed && s.pressed,
        ];
      }}
    >
      <Text style={[s.startText, secondary && s.secondaryText]}>{label}</Text>
      <Ionicons
        name="arrow-forward"
        size={21}
        color={secondary ? '#203247' : '#FFFFFF'}
      />
    </Pressable>
  );
}

// 부가 기능은 반복 카드 대신 한 줄 탐색 항목으로 제공한다.
function HomeLink({
  label,
  detail,
  icon,
  onPress,
}: {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  // 버튼명과 설명을 함께 읽을 수 있게 유지한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.linkRow}
    >
      <Ionicons name={icon} size={23} color="#203247" />
      <View style={s.linkCopy}>
        <Text style={s.linkText}>{label}</Text>
        <Text style={s.supporting}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#697581" />
    </Pressable>
  );
}
