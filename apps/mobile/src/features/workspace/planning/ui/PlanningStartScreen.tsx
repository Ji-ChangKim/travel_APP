import HomeJourneyStart from '../../home/ui/HomeJourneyStart';
import LegacyDraftImport from './LegacyDraftImport';
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { discoveryDestinations, type PersistedTrip } from '@wherego/domain';
import ActionSheet from '@/components/ui/ActionSheet';
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
import { cityGuides } from '../../community/model/cityGuides';
import { tripListQueryOptions } from '../../shared/manager/tripQueries';
import { readCreationDrafts } from '../manager/creationDraftStorage';
import {
  homeDaysLeft,
  homeTravelGroups,
} from '../../home/model/homeTravelModel';
import { homeTravelStyles as s } from '../../home/styles/homeTravelStyles';
import { useTripDateRefresh } from '../../shared/manager/useTripDateRefresh';
import HaruDailyTip from '../../home/ui/HaruDailyTip';
import HomeTravelCard from '../../home/ui/HomeTravelCard';
import HomeDraftResume from '../../home/ui/HomeDraftResume';

// 계정 변경 시 이전 사용자의 펼침·조회 상태를 새 화면으로 교체한다.
export default function PlanningStartScreen() {
  const userId = useTripStore((state) => state.currentUser?.id || '');
  const isGuest = useTripStore(
    (state) => state.currentUser?.authProvider === 'guest',
  );
  return <TravelHome key={userId} userId={userId} isGuest={isGuest} />;
}

function TravelHome({ userId, isGuest }: { userId: string; isGuest: boolean }) {
  useLocale();
  useTripDateRefresh();
  const router = useRouter();
  const ready = useAuthReady((state) => state.ready);
  const [expanded, setExpanded] = useState(false);
  const [receiptSelection, setReceiptSelection] = useState(false);
  const trips = useQuery({
    ...tripListQueryOptions(userId),
    enabled: Boolean(ready && userId),
  });
  const drafts = useQuery({
    queryKey: ['creation-drafts', userId],
    queryFn: () => readCreationDrafts(userId),
    enabled: Boolean(ready && userId && !isGuest),
    retry: false,
  });
  const refreshTrips = trips.refetch;
  const refreshDrafts = drafts.refetch;
  useFocusEffect(
    useCallback(() => {
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
  function create() {
    router.push('/new-trip');
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
        <HomeJourneyStart
          ready={ready}
          onCreate={create}
          onReceipts={() => setReceiptSelection(true)}
        />
        {loading ? (
          <HaruState kind="loading" title={t('내 여행 불러오는 중…')} compact />
        ) : (
          <>
            {trips.isError && (
              <View style={s.section}>
                <Text accessibilityRole="alert">
                  {t('내 여행을 불러오지 못했어요')}
                </Text>
                <DesignButton
                  label={t('내 여행 다시 불러오기')}
                  onPress={() => void trips.refetch()}
                />
              </View>
            )}
            {drafts.isError && (
              <View style={s.section}>
                <Text accessibilityRole="alert">
                  {t('임시 계획을 불러오지 못했어요.')}
                </Text>
                <DesignButton
                  label={t('임시 계획 다시 불러오기')}
                  onPress={() => void drafts.refetch()}
                />
              </View>
            )}
            {groups.active.length > 0 && (
              <View style={s.section}>
                <Text accessibilityRole="header" style={s.title}>
                  {t('여행 중')}
                </Text>
                {groups.active.map((item) => (
                  <HomeTravelCard
                    key={item.id}
                    item={item}
                    userId={userId}
                    inTrip
                  />
                ))}
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
            {empty && !trips.isError && !drafts.isError && (
              <HomeEmptySection
                hasCompleted={Boolean(trips.data?.length)}
                onCreate={create}
                onOpenGuide={(key) => router.push(`/destinations/${key}`)}
              />
            )}
            {groups.scheduled.length > 0 && (
              <View testID="home-scheduled" style={s.section}>
                <View style={s.heading}>
                  <Text accessibilityRole="header" style={s.title}>
                    {t('예정된 여행')} {groups.scheduled.length}
                  </Text>
                  <DesignButton
                    label={t('전체보기')}
                    variant="quiet"
                    onPress={() => router.push('/plans')}
                  />
                </View>
                {groups.scheduled.slice(0, 3).map((item) => (
                  <HomeTravelCard key={item.id} item={item} userId={userId} />
                ))}
              </View>
            )}
            {groups.undated.length > 0 && (
              <View testID="home-undated" style={s.section}>
                <Text accessibilityRole="header" style={s.title}>
                  {t('작성 중인 일정')}
                </Text>
                {groups.undated.map((item) => (
                  <HomeTravelCard key={item.id} item={item} userId={userId} />
                ))}
              </View>
            )}
          </>
        )}
        <View style={s.section}>
          <DesignButton
            label={t('전체 여행 관리')}
            variant="quiet"
            onPress={() => router.push('/plans')}
          />
          {Boolean(userId) && (
            <DesignButton
              label={t('작성 중인 계획 관리')}
              variant="quiet"
              onPress={() => setExpanded(true)}
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
        onRefetchTrips={() => void trips.refetch()}
        receiptSelection={receiptSelection}
        setReceiptSelection={setReceiptSelection}
        expanded={expanded}
        setExpanded={setExpanded}
        onCreate={create}
      />
    </SafeAreaView>
  );
}

function HomeEmptySection({
  hasCompleted,
  onCreate,
  onOpenGuide,
}: {
  hasCompleted: boolean;
  onCreate: () => void;
  onOpenGuide: (key: string) => void;
}) {
  return (
    <View style={s.section}>
      <View testID="home-empty" style={s.emptyHero}>
        <View style={s.emptyIconBadge} accessible={false}>
          <Text style={{ fontSize: 24 }}>🧭</Text>
        </View>
        <Text accessibilityRole="header" style={s.emptyTitle}>
          {t(hasCompleted ? '다음 여행을 계획해 보세요' : '어디로 떠나시나요?')}
        </Text>
        <Text style={s.emptyDesc}>
          {t(
            '일정을 등록하고 영수증을 모아보세요.\n나만의 여행 노트가 완성됩니다.',
          )}
        </Text>
        <DesignButton
          label={t('새 여행 시작하기')}
          variant="primary"
          onPress={onCreate}
        />
      </View>
      <View style={s.section}>
        <View style={s.subHeaderRow}>
          <Text style={s.subHeaderTitle}>{t('추천 여행지 가이드')}</Text>
          <Text style={s.subHeaderLink}>{t('관광청 공식 정보')}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.destScroll}
        >
          {discoveryDestinations.slice(0, 4).map((dest) => {
            const guide = cityGuides[dest.key];
            return (
              <Pressable
                key={dest.key}
                accessibilityRole="link"
                accessibilityLabel={`${dest.city} ${dest.country}`}
                style={s.destCard}
                onPress={() => onOpenGuide(dest.key)}
              >
                <Image
                  source={guide.photo}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessible={false}
                />
                <View style={s.heroScrim} pointerEvents="none" />
                <View style={{ zIndex: 1, gap: 2 }} accessible={false}>
                  {guide.seasons[0]?.months ? (
                    <View style={s.destTag}>
                      <Text style={s.destTagText}>
                        {guide.seasons[0].months}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={s.destName}>{dest.city}</Text>
                  <Text style={s.destDesc} numberOfLines={1}>
                    {dest.country} · {guide.places[0]?.title || ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function HomeActionSheets({
  userId,
  ready,
  loading,
  tripsError,
  tripsData,
  onRefetchTrips,
  receiptSelection,
  setReceiptSelection,
  expanded,
  setExpanded,
  onCreate,
}: {
  userId: string;
  ready: boolean;
  loading: boolean;
  tripsError: boolean;
  tripsData: PersistedTrip[];
  onRefetchTrips: () => void;
  receiptSelection: boolean;
  setReceiptSelection: (value: boolean) => void;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  onCreate: () => void;
}) {
  const router = useRouter();
  const activeTrips = tripsData.filter((trip) => trip.status !== 'ARCHIVED');
  return (
    <>
      <ActionSheet
        visible={receiptSelection}
        title={t('기록할 여행 선택')}
        onClose={() => setReceiptSelection(false)}
      >
        <Text style={s.body}>
          {t(
            '여행의 비용 화면에서 영수증을 등록하고 방문 기록을 확인할 수 있어요.',
          )}
        </Text>
        {!userId && ready ? (
          <DesignButton
            label={t('로그인하고 내 여행 찾기')}
            onPress={() => {
              setReceiptSelection(false);
              router.push({ pathname: '/login', params: { next: 'plans' } });
            }}
          />
        ) : loading ? (
          <HaruState kind="loading" title={t('내 여행 불러오는 중…')} compact />
        ) : tripsError ? (
          <DesignButton
            label={t('내 여행 다시 불러오기')}
            onPress={onRefetchTrips}
          />
        ) : activeTrips.length ? (
          activeTrips.map((trip) => (
            <DesignButton
              key={trip.id}
              label={trip.title || t('새 여행 계획')}
              onPress={() => {
                setReceiptSelection(false);
                router.push({
                  pathname: '/trips/[id]',
                  params: { id: trip.id, section: 'expenses' },
                });
              }}
            />
          ))
        ) : (
          <HaruState
            kind="empty"
            title={t('먼저 여행을 만들어 주세요')}
            compact
          >
            <DesignButton
              label={t('새 여행 만들기')}
              onPress={() => {
                setReceiptSelection(false);
                onCreate();
              }}
            />
          </HaruState>
        )}
      </ActionSheet>
      <ActionSheet
        visible={expanded}
        title={t('작성 중인 계획 관리')}
        onClose={() => setExpanded(false)}
      >
        <LegacyDraftImport userId={userId} />
        <HomeDraftResume userId={userId} onOpen={() => setExpanded(false)} />
        <DesignButton
          label={t('전체 여행 관리')}
          onPress={() => {
            setExpanded(false);
            router.push('/plans');
          }}
        />
      </ActionSheet>
    </>
  );
}
