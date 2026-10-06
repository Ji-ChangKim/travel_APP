import HaruState from '@/components/HaruState';
import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { listServerTrips } from '@wherego/api-client';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { Action, styles } from './ui';
import { homeDestinations } from './homeDestinations';
import { tripStatusLabel } from './presentation';

interface HomeProps {
  userId: string;
  trips: Awaited<ReturnType<typeof listServerTrips>> | undefined;
  loading: boolean;
  error: string;
  onReload: () => void;
}

// 빈 목록 대신 여행 시작·기존 여행 재개라는 목적을 가진 홈을 표시한다.
export default function HomeScreen(props: HomeProps) {
  // 선택 목적지와 인증 확인 상태만 홈 표현에 연결한다.
  return (
    <HomeContent
      {...props}
      router={useRouter()}
      destinationState={useState('')}
      ready={useAuthReady((state) => {
        // 초기 인증 조회 중에는 신규 회원으로 단정하지 않는다.
        return state.ready;
      })}
    />
  );
}

// 로그인 전 선택 목적지를 인증 후 생성 페이지로 전달한다.
function startTrip(
  router: ReturnType<typeof useRouter>,
  userId: string,
  destination: string,
): void {
  // 인증 복귀 경로는 고정 페이지와 검증할 목적지 키만 사용한다.
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

// 진행 중인 여행을 먼저, 나머지 여행을 시작 날짜순으로 정렬한다.
function continuingTrips(trips: HomeProps['trips']) {
  // 완료·보관 여행은 홈의 재개 대상에서 제외한다.
  return (trips || [])
    .filter((trip) => {
      // 발자국 목록과 계획 재개 목록을 구분한다.
      return trip.status !== 'COMPLETED' && trip.status !== 'ARCHIVED';
    })
    .sort((left, right) => {
      // 오늘 진행 중인 여행에 가장 빨리 접근한다.
      return (
        Number(right.status === 'IN_PROGRESS') -
          Number(left.status === 'IN_PROGRESS') ||
        left.startDate.localeCompare(right.startDate)
      );
    });
}

// 실제 저장 여행에 맞는 홈 콘텐츠와 시작 도구를 구성한다.
function HomeContent({
  userId,
  trips,
  loading,
  error,
  onReload,
  router,
  destinationState,
  ready,
}: HomeProps & {
  router: ReturnType<typeof useRouter>;
  destinationState: [string, Dispatch<SetStateAction<string>>];
  ready: boolean;
}) {
  // 목록이 없어도 목적지 선택·결과 예시·첫 행동은 항상 제공한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={homeStyles.content}>
        <View style={homeStyles.topBar}>
          <Image
            source={require('../../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
            style={homeStyles.logo}
            resizeMode="contain"
            accessibilityLabel="TripPrint 트립프린트"
          />
          {!userId && ready && (
            <Action
              label="로그인"
              variant="quiet"
              onPress={() => {
                // 저장하지 않고 둘러본 사용자가 직접 계정 인증을 시작한다.
                return router.push('/login');
              }}
            />
          )}
        </View>
        {(!ready || loading) && (
          <HaruState
            kind="loading"
            title="내 여행을 확인하고 있어요."
            compact
          />
        )}
        {error && (
          <HaruState
            kind="error"
            title="내 여행을 불러오지 못했어요"
            description={error}
          >
            <Action label="내 여행 다시 불러오기" onPress={onReload} />
          </HaruState>
        )}
        {continuingTrips(trips).length > 0 && (
          <View style={homeStyles.section}>
            <Text style={homeStyles.sectionTitle}>이어서 준비할 여행</Text>
            {continuingTrips(trips).map((trip) => (
              /* 실제 서버 여행의 재개 카드 하나를 표시한다. */ <View
                key={trip.id}
                style={homeStyles.travelCard}
              >
                <View style={styles.row}>
                  <Text style={styles.badge}>
                    {tripStatusLabel(trip.status)}
                  </Text>
                  <Text style={styles.subtitle}>
                    {trip.country} · {trip.city}
                  </Text>
                </View>
                <Text style={styles.title}>{trip.title}</Text>
                <Text style={styles.subtitle}>
                  {trip.startDate} ~ {trip.endDate}
                </Text>
                <Action
                  label="여행 열기"
                  variant="primary"
                  onPress={() => {
                    // 실제 서버 여행 ID로 일정 재개 화면을 연다.
                    return router.push(`/trips/${trip.id}`);
                  }}
                />
              </View>
            ))}
          </View>
        )}
        <View style={homeStyles.hero}>
          <Text style={homeStyles.eyebrow}>나의 다음 발자국</Text>
          <Text style={homeStyles.headline}>
            다음 여행은,{'\n'}어디로 떠나볼까요?
          </Text>
          <Text style={homeStyles.description}>
            가고 싶은 곳과 날짜를 정해 보세요.{'\n'}하루씩 계획하고, 친구와 함께
            채워요.
          </Text>
          <View style={homeStyles.destinationGrid}>
            {homeDestinations.map((destination) => (
              /* 목적지 선택 상태를 가진 버튼 하나를 표시한다. */ <Pressable
                key={destination.key}
                accessibilityRole="button"
                accessibilityLabel={`${destination.city} 선택`}
                accessibilityState={{
                  selected: destinationState[0] === destination.key,
                }}
                onPress={() => {
                  // 누른 목적지는 인증 후에도 생성 폼에서 유지한다.
                  return destinationState[1](destination.key);
                }}
                style={[
                  homeStyles.destination,
                  destinationState[0] === destination.key &&
                    homeStyles.destinationSelected,
                ]}
              >
                <Ionicons
                  name={destination.icon}
                  size={22}
                  color={
                    destinationState[0] === destination.key
                      ? '#C84432'
                      : '#203247'
                  }
                />
                <View>
                  <Text style={homeStyles.destinationCity}>
                    {destination.city}
                  </Text>
                  <Text style={homeStyles.destinationCountry}>
                    {destination.country}
                  </Text>
                </View>
                {destinationState[0] === destination.key && (
                  <Ionicons name="checkmark-circle" size={18} color="#C84432" />
                )}
              </Pressable>
            ))}
          </View>
          <Action
            label="새 여행 시작하기"
            variant="primary"
            onPress={() => {
              // 목적지를 고르지 않아도 직접 검색하는 생성 흐름으로 이동한다.
              return startTrip(router, userId, destinationState[0]);
            }}
          />
          <Text style={homeStyles.hint}>
            {userId
              ? '다른 목적지도 직접 입력할 수 있어요.'
              : '여행을 저장하려면 로그인이 필요해요. 선택한 목적지는 유지돼요.'}
          </Text>
        </View>
        <View style={homeStyles.section}>
          <View style={homeStyles.sectionHeading}>
            <Text style={homeStyles.sectionTitle}>계획이 기록이 되는 순간</Text>
            <Text style={homeStyles.exampleBadge}>사용 예시</Text>
          </View>
          <Text style={styles.subtitle}>
            장소, 식사, 숙소를 하루 일정에 모으고{'\n'}다녀온 뒤 사진과 쓴
            비용을 남겨보세요.
          </Text>
          <View style={homeStyles.preview}>
            <Text style={homeStyles.previewDay}>DAY 1 · 여행의 첫날</Text>
            {[
              {
                time: '10:00',
                title: '가고 싶었던 장소',
                detail: '관광 · 장소와 이동 계획',
                icon: 'location-outline',
              },
              {
                time: '12:00',
                title: '오늘의 점심',
                detail: '식사 · 사진과 실제 비용 기록',
                icon: 'restaurant-outline',
              },
              {
                time: '15:00',
                title: '숙소 체크인',
                detail: '숙소 · 주소와 예약 메모',
                icon: 'bed-outline',
              },
            ].map((item) => (
              /* 실제 후기와 구분한 하루 일정 사용 예시 하나를 표시한다. */ <View
                key={item.time}
                style={homeStyles.previewRow}
              >
                <Text style={homeStyles.previewTime}>{item.time}</Text>
                <View style={homeStyles.previewIcon}>
                  <Ionicons
                    name={
                      item.icon as
                        | 'location-outline'
                        | 'restaurant-outline'
                        | 'bed-outline'
                    }
                    size={19}
                    color="#C84432"
                  />
                </View>
                <View style={homeStyles.previewCopy}>
                  <Text style={homeStyles.previewTitle}>{item.title}</Text>
                  <Text style={homeStyles.previewDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
            <View style={homeStyles.previewFooter}>
              <Ionicons name="footsteps-outline" size={20} color="#203247" />
              <Text style={homeStyles.previewFooterText}>
                여행을 마치면 나만의 발자국으로
              </Text>
            </View>
          </View>
        </View>
        <View style={homeStyles.section}>
          <Text style={homeStyles.sectionTitle}>친구와 함께 떠나나요?</Text>
          <Text style={styles.subtitle}>
            전달받은 초대 링크로 같은 여행에 참여하세요.
          </Text>
          <Action
            label="초대 링크로 참여"
            onPress={() => {
              // 받은 초대의 확인과 로그인 흐름을 유지한다.
              return router.push('/invite');
            }}
          />
        </View>
        {trips?.some((trip) => {
          // 완료 여행이 있는 계정은 홈에서도 기록으로 바로 이동한다.
          return trip.status === 'COMPLETED';
        }) && (
          <View style={homeStyles.section}>
            <Text style={homeStyles.sectionTitle}>
              다녀온 여행, 나의 발자국
            </Text>
            {trips
              .filter((trip) => {
                // 실제 완료한 내 여행 제목만 표시한다.
                return trip.status === 'COMPLETED';
              })
              .map((trip) => (
                /* 완료한 여행 제목을 발자국 진입 안내에 표시한다. */ <Text
                  key={trip.id}
                  style={styles.subtitle}
                >
                  {trip.title}
                </Text>
              ))}
            <Action
              label="완성된 발자국 보기"
              onPress={() => {
                // 완료 여행은 기존 다이어리 컬렉션에서 읽는다.
                return router.push('/(tabs)/footprints');
              }}
            />
          </View>
        )}
        <View style={homeStyles.section}>
          <Text style={homeStyles.sectionTitle}>
            다른 사람의 여행이 궁금하다면
          </Text>
          <Text style={styles.subtitle}>
            여행자들이 직접 공개한 일정과 기록을 살펴보세요.
          </Text>
          <Action
            label="커뮤니티"
            onPress={() => {
              // 공개 여행 탐색은 홈의 시작 행동과 별도 경로로 제공한다.
              return router.push('/(tabs)/community');
            }}
          />
        </View>
        {trips?.some((trip) => {
          // 보관된 여행도 홈에서 접근할 수 있게 유지한다.
          return trip.status === 'ARCHIVED';
        }) && (
          <View style={homeStyles.section}>
            <Text style={homeStyles.sectionTitle}>보관한 여행</Text>
            {trips
              .filter((trip) => {
                // 서버가 반환한 보관 여행만 표시한다.
                return trip.status === 'ARCHIVED';
              })
              .map((trip) => (
                /* 보관 여행의 읽기 경로를 가진 카드 하나를 표시한다. */ <View
                  key={trip.id}
                  style={styles.card}
                >
                  <Text style={styles.title}>{trip.title}</Text>
                  <Action
                    label="보관 여행 열기"
                    onPress={() => {
                      // 보관 여행의 기존 읽기 경로를 유지한다.
                      return router.push(`/trips/${trip.id}`);
                    }}
                  />
                </View>
              ))}
          </View>
        )}
        <Action
          label="Google Maps 장소 가져오기"
          variant="quiet"
          onPress={() => {
            // 공유 장소 도구는 시작 행동 아래에서 필요할 때 연다.
            return router.push('/import-place');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// 홈의 정보 우선순위와 선택 상태를 브랜드 색상으로 표현한다.
const homeStyles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 26,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
  },
  logo: { width: 128, height: 40 },
  section: { gap: 12 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { color: '#203247', fontSize: 19, fontWeight: '800' },
  hero: {
    padding: 20,
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE3DA',
    borderRadius: 24,
  },
  eyebrow: { color: '#C84432', fontSize: 12, fontWeight: '700' },
  headline: {
    color: '#203247',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 39,
    letterSpacing: -0.8,
  },
  description: { color: '#59677A', fontSize: 14, lineHeight: 23 },
  destinationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexBasis: '44%',
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFF9F3',
  },
  destinationSelected: { borderColor: '#C84432', backgroundColor: '#FFF0ED' },
  destinationCity: { color: '#203247', fontSize: 15, fontWeight: '700' },
  destinationCountry: { color: '#59677A', fontSize: 11, marginTop: 3 },
  hint: { fontSize: 11, color: '#59677A', lineHeight: 18 },
  travelCard: {
    padding: 20,
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6D4C9',
  },
  exampleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 11,
    color: '#59677A',
    backgroundColor: '#F0E8E0',
  },
  preview: {
    borderWidth: 1,
    borderColor: '#EEE3DA',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  previewDay: {
    padding: 16,
    color: '#203247',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#F6EEE5',
  },
  previewRow: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  previewTime: { fontSize: 12, color: '#59677A', width: 39 },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCopy: { flex: 1, gap: 5 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#203247' },
  previewDetail: { fontSize: 11, color: '#59677A', lineHeight: 17 },
  previewFooter: {
    padding: 16,
    backgroundColor: '#F0F7FA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewFooterText: {
    color: '#203247',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
