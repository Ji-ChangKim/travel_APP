import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import HomeHeader from '@/components/navigation/HomeHeader';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import HaruState from '@/components/feedback/HaruState';
import { colors } from '@/constants/theme';
import { onGnbScroll } from '@/components/navigation/navigationScroll';
import { useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from '@/features/auth/manager/AuthBridge';
import { tripListQueryOptions } from '../../shared/manager/tripQueries';
import { useTripDateRefresh } from '../../shared/manager/useTripDateRefresh';
import { readCreationDrafts } from '../manager/creationDraftStorage';
import {
  homeDaysLeft,
  homeTravelGroups,
} from '../../home/model/homeTravelModel';
import { homeTravelStyles as s } from '../../home/styles/homeTravelStyles';
import HaruDailyTip from '../../home/ui/HaruDailyTip';
import HomeActionSheets from '../../home/ui/HomeActionSheets';
import {
  HomeCoreToolsGrid,
  HomeEmptySection,
  HomeGreetingSection,
  HomeVerifiedCoursesSection,
} from '../../home/ui/HomeConciergeSections';
import HomeJourneyStart from '../../home/ui/HomeJourneyStart';
import HomeTravelCard from '../../home/ui/HomeTravelCard';

// 계정 변경 시 이전 사용자의 펼침·조회 상태를 새 화면으로 교체한다.
export default function PlanningStartScreen() {
  // 현재 로그인한 사용자 ID와 게스트 여부, 표시 이름을 구독한다.
  const userId = useTripStore((state) => {
    // 사용자 식별자가 없으면 빈 문자열로 처리한다.
    return state.currentUser?.id || '';
  });
  const isGuest = useTripStore((state) => {
    // 게스트 세션인지 확인한다.
    return state.currentUser?.authProvider === 'guest';
  });
  const nickname = useTripStore((state) => {
    // 정식 프로필의 닉네임을 인사말에 사용한다.
    return state.currentUser?.nickname || '';
  });
  return (
    <TravelHome
      key={userId}
      userId={userId}
      isGuest={isGuest}
      nickname={nickname}
    />
  );
}

// 사용자의 여행 생애주기(여행 전·중·후 및 빈 상태)에 맞춰 동적으로 변모하는 컨시어지 홈을 렌더링한다.
function TravelHome({
  userId,
  isGuest,
  nickname,
}: {
  userId: string;
  isGuest: boolean;
  nickname: string;
}) {
  useLocale();
  useTripDateRefresh();
  // 라우터·인증 준비 상태·바텀시트 열림 상태·여행/초안 쿼리를 준비한다.
  const router = useRouter();
  const ready = useAuthReady((state) => {
    // 인증 브리지 초기화 완료 여부를 읽는다.
    return state.ready;
  });
  const [expanded, setExpanded] = useState(false);
  const [receiptSelection, setReceiptSelection] = useState(false);
  const [checklistSelection, setChecklistSelection] = useState(false);
  const [safetySheetOpen, setSafetySheetOpen] = useState(false);
  const trips = useQuery({
    ...tripListQueryOptions(userId),
    enabled: Boolean(ready && userId),
  });
  const drafts = useQuery({
    queryKey: ['creation-drafts', userId],
    queryFn: () => {
      // 계정에 저장된 작성 중 초안 목록을 조회한다.
      return readCreationDrafts(userId);
    },
    enabled: Boolean(ready && userId && !isGuest),
    retry: false,
  });
  const refreshTrips = trips.refetch;
  const refreshDrafts = drafts.refetch;
  useFocusEffect(
    useCallback(() => {
      // 홈 화면 포커스 시 서버 여행과 임시 초안을 최신 상태로 갱신한다.
      if (ready && userId) {
        void refreshTrips();
        if (!isGuest) void refreshDrafts();
      }
    }, [ready, userId, isGuest, refreshTrips, refreshDrafts]),
  );
  const groups = homeTravelGroups(
    trips.isError ? [] : trips.data || [],
    isGuest || drafts.isError ? [] : drafts.data || [],
  );
  const loading =
    !ready ||
    Boolean(userId && (trips.isPending || (!isGuest && drafts.isPending)));
  const empty =
    !groups.upcoming &&
    !groups.active.length &&
    !groups.undated.length &&
    !groups.scheduled.length;
  const showEmptyPlanner =
    !loading && empty && !trips.isError && !drafts.isError;
  const leadTrip = groups.active[0] || groups.upcoming || groups.undated[0];

  // 새 여행 생성 페이지로 이동한다.
  function create() {
    // 기본 생성 경로로 이동한다.
    router.push('/new-trip');
  }

  // 다녀온 여행 기록 모드로 새 여행 생성 페이지를 연다.
  function createRecord() {
    router.push({ pathname: '/new-trip', params: { mode: 'record' } });
  }

  // 특정 추천 도시가 선택된 상태로 새 여행 생성 페이지를 연다.
  function createWithDestination(destinationKey: string) {
    // 선택한 도시 키를 쿼리 파라미터로 전달해 첫 입력 단계를 단축한다.
    router.push({
      pathname: '/new-trip',
      params: { destination: destinationKey },
    });
  }

  // 선택한 도시의 커뮤니티 다녀온 기록 목록으로 이동한다.
  function openCommunityCity(city: string) {
    router.push({ pathname: '/footprints', params: { q: city } });
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <HomeHeader
        signedIn={Boolean(userId)}
        ready={ready}
        variant="travel-home"
      />
      <ScrollView
        testID="travel-home"
        contentContainerStyle={s.content}
        onScroll={onGnbScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={
              !loading &&
              (trips.isRefetching || (!isGuest && drafts.isRefetching))
            }
            onRefresh={() => {
              // 당겨서 새로고침 시 여행 목록과 초안 목록을 다시 불러온다.
              if (ready && userId) {
                void refreshTrips();
                if (!isGuest) void refreshDrafts();
              }
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <HomeGreetingSection
          nickname={nickname}
          leadTrip={leadTrip}
          activeCount={groups.active.length}
          hasCompleted={Boolean(trips.data?.length)}
        />

        <HomeConciergeMainBody
          userId={userId}
          ready={ready}
          loading={loading}
          tripsError={trips.isError}
          draftsError={drafts.isError}
          hasCompleted={Boolean(trips.data?.length)}
          showEmptyPlanner={showEmptyPlanner}
          groups={groups}
          onRefetchTrips={() => {
            // 여행 목록 조회 실패 시 재시도한다.
            void trips.refetch();
          }}
          onRefetchDrafts={() => {
            // 초안 목록 조회 실패 시 재시도한다.
            void drafts.refetch();
          }}
          onCreate={create}
          onCreateRecord={createRecord}
          onBrowseCourses={() => {
            // 인기 여행 코스 둘러보기 클릭 시 발자국 화면으로 이동한다.
            router.push('/footprints');
          }}
          onOpenGuide={(key) => {
            // 공식 도시 가이드 상세 화면으로 이동한다.
            router.push(`/destinations/${key}`);
          }}
        />

        {!loading && groups.scheduled.length > 0 && (
          <View testID="home-scheduled" style={s.section}>
            <View style={s.heading}>
              <Text accessibilityRole="header" style={s.title}>
                {t('예정된 여행')} {groups.scheduled.length}
              </Text>
              <DesignButton
                label={t('전체보기')}
                variant="quiet"
                onPress={() => {
                  // 내 여행 전체 목록 화면으로 이동한다.
                  router.push('/plans');
                }}
              />
            </View>
            {groups.scheduled.slice(0, 3).map((item) => {
              // 최대 3개의 추가 예정 여행 카드를 표시한다.
              return (
                <HomeTravelCard key={item.id} item={item} userId={userId} />
              );
            })}
          </View>
        )}

        {!loading && groups.undated.length > 0 && (
          <View testID="home-undated" style={s.section}>
            <Text accessibilityRole="header" style={s.title}>
              {t('작성 중인 일정')}
            </Text>
            {groups.undated.map((item) => {
              // 출발일 미정 여행이나 서버 초안을 이어쓰기 카드로 표시한다.
              return (
                <HomeTravelCard key={item.id} item={item} userId={userId} />
              );
            })}
          </View>
        )}

        {!showEmptyPlanner && (
          <HomeJourneyStart
            ready={ready}
            onCreate={create}
            onReceipts={() => {
              // 영수증 기록 대상 여행 선택 시트를 연다.
              setReceiptSelection(true);
            }}
            subtitle={t('추천: 도쿄 3박 4일 일정 만들기')}
          />
        )}

        <HomeVerifiedCoursesSection
          onStartCourse={createWithDestination}
          onOpenGuide={(key) => {
            // 선택한 코스의 공식 도시 가이드를 연다.
            router.push(`/destinations/${key}`);
          }}
          onOpenCommunityCity={openCommunityCity}
        />

        <HomeCoreToolsGrid
          ready={ready}
          onOpenReceipts={() => {
            // 가계부/영수증 기록 시트를 연다.
            setReceiptSelection(true);
          }}
          onOpenChecklist={() => {
            // 필수 준비물 체크리스트 시트를 연다.
            setChecklistSelection(true);
          }}
          onOpenSafetyGuide={() => {
            // 현지 비상/교통 공식 안내 시트를 연다.
            setSafetySheetOpen(true);
          }}
        />

        <View style={s.section}>
          <DesignButton
            label={t('전체 여행 관리')}
            variant="quiet"
            onPress={() => {
              // 내 여행 탭으로 이동한다.
              router.push('/plans');
            }}
          />
          {Boolean(userId) && (
            <DesignButton
              label={t('작성 중인 계획 관리')}
              variant="quiet"
              onPress={() => {
                // 작성 중인 계획 관리 시트를 연다.
                setExpanded(true);
              }}
            />
          )}
        </View>
        <HaruDailyTip />
      </ScrollView>
      <HomeActionSheets
        userId={userId}
        ready={ready}
        loading={loading}
        tripsError={trips.isError}
        tripsData={trips.data || []}
        onRefetchTrips={() => {
          // 시트 내부에서 여행 목록 재조회를 실행한다.
          void trips.refetch();
        }}
        receiptSelection={receiptSelection}
        setReceiptSelection={setReceiptSelection}
        checklistSelection={checklistSelection}
        setChecklistSelection={setChecklistSelection}
        safetySheetOpen={safetySheetOpen}
        setSafetySheetOpen={setSafetySheetOpen}
        expanded={expanded}
        setExpanded={setExpanded}
        onCreate={create}
      />
    </SafeAreaView>
  );
}

// 퍼스트 폴드 컨시어지 영역(로딩·오류·여행 중·다가오는 여행·빈 상태 플래너)을 상태에 맞춰 분기한다.
function HomeConciergeMainBody({
  userId,
  ready,
  loading,
  tripsError,
  draftsError,
  hasCompleted,
  showEmptyPlanner,
  groups,
  onRefetchTrips,
  onRefetchDrafts,
  onCreate,
  onCreateRecord,
  onBrowseCourses,
  onOpenGuide,
}: {
  userId: string;
  ready: boolean;
  loading: boolean;
  tripsError: boolean;
  draftsError: boolean;
  hasCompleted: boolean;
  showEmptyPlanner: boolean;
  groups: ReturnType<typeof homeTravelGroups>;
  onRefetchTrips: () => void;
  onRefetchDrafts: () => void;
  onCreate: () => void;
  onCreateRecord: () => void;
  onBrowseCourses: () => void;
  onOpenGuide: (key: string) => void;
}) {
  // 로딩 중에는 스켈레톤 상태를, 완료 후에는 활성 여행 또는 빈 상태 플래너를 렌더링한다.
  if (loading) {
    return (
      <HaruState kind="loading" title={t('내 여행 불러오는 중…')} compact />
    );
  }
  return (
    <>
      {tripsError && (
        <View style={s.section}>
          <Text accessibilityRole="alert">
            {t('내 여행을 불러오지 못했어요')}
          </Text>
          <DesignButton
            label={t('내 여행 다시 불러오기')}
            onPress={onRefetchTrips}
          />
        </View>
      )}
      {draftsError && (
        <View style={s.section}>
          <Text accessibilityRole="alert">
            {t('임시 계획을 불러오지 못했어요.')}
          </Text>
          <DesignButton
            label={t('임시 계획 다시 불러오기')}
            onPress={onRefetchDrafts}
          />
        </View>
      )}
      {groups.active.length > 0 && (
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.title}>
            {t('여행 중')}
          </Text>
          {groups.active.map((item) => {
            // 현재 진행 중인 각 여행을 실시간 컨시어지 카드로 표시한다.
            return (
              <HomeTravelCard
                key={item.id}
                item={item}
                userId={userId}
                inTrip
              />
            );
          })}
        </View>
      )}
      {groups.upcoming && (
        <View testID="home-upcoming" style={s.section}>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.title}>
              {t('다가오는 여행')}
            </Text>
            <Text style={s.badge}>
              {homeDaysLeft(groups.upcoming) === 0
                ? 'D-Day'
                : `D-${homeDaysLeft(groups.upcoming)}`}
            </Text>
          </View>
          <HomeTravelCard item={groups.upcoming} userId={userId} hero />
        </View>
      )}
      {!groups.active.length &&
        !groups.upcoming &&
        groups.past &&
        groups.past.length > 0 && (
          <View style={s.section}>
            <Text accessibilityRole="header" style={s.title}>
              {t('다녀온 여행 정리')}
            </Text>
            {groups.past.slice(0, 1).map((item) => (
              <HomeTravelCard
                key={item.id}
                item={item}
                userId={userId}
                inTrip
              />
            ))}
          </View>
        )}
      {showEmptyPlanner && (
        <HomeEmptySection
          ready={ready}
          hasCompleted={hasCompleted}
          onCreate={onCreate}
          onCreateRecord={onCreateRecord}
          onBrowseCourses={onBrowseCourses}
          onOpenGuide={onOpenGuide}
        />
      )}
    </>
  );
}
