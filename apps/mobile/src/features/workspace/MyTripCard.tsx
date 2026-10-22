import { useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import type { PersistedTrip, WorkspaceSnapshot } from '@wherego/domain';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import MyTripsButton from './MyTripsButton';
import { myTripsStyles as s, myTripsColors as c } from './myTripsStyles';
import { myTripFacts, myTripTiming } from './myTripsModel';
import { useMyTripDetails } from './useMyTripDetails';
import { usePrivatePhotoQuery } from './usePrivatePhoto';
import { travelPlanPath } from './travelPlans';

// 실제 여행 요약과 현재 계정이 읽을 수 있는 개인 원본을 카드에 연결한다.
export default function MyTripCard({
  trip,
  userId,
}: {
  trip: PersistedTrip;
  userId: string;
}) {
  // 권한 오류가 나면 이전 원본의 사진·건수·공개 상태를 표시하지 않는다.
  const query = useMyTripDetails(userId, trip.id);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const snapshot = query.isError ? undefined : query.data;
  const timing = myTripTiming(snapshot?.trip || trip);
  return (
    <View style={s.card} testID={`my-trip-card-${trip.id}`}>
      <MyTripCover
        trip={snapshot?.trip || trip}
        userId={userId}
        snapshot={snapshot}
      />
      <View style={s.cardBody}>
        <View style={s.wrapRow}>
          <View style={s.row}>
            <Ionicons name="calendar-outline" size={15} color={c.muted} />
            <Text style={s.caption}>{timing.dates}</Text>
          </View>
          <Text style={s.strongCaption}>
            {timing.phase === 'IN_PROGRESS' && timing.total
              ? `${timing.total}일 중 ${timing.day}일차`
              : snapshot
                ? `등록 장소 ${myTripFacts(snapshot).placeCount}곳`
                : ''}
          </Text>
        </View>
        {timing.phase === 'IN_PROGRESS' && timing.total > 0 && (
          <View
            style={s.progress}
            accessibilityLabel={`여행 ${timing.total}일 중 ${timing.day}일차`}
          >
            <View
              style={[s.progressFill, { width: `${timing.progress * 100}%` }]}
            />
          </View>
        )}
        {snapshot ? (
          <MyTripFactsView snapshot={snapshot} />
        ) : (
          <View style={s.panel}>
            <Text style={s.body}>
              {query.isError
                ? '여행 정보를 불러오지 못했어요.'
                : '여행 정보를 불러오는 중이에요.'}
            </Text>
            {query.isError && (
              <MyTripsButton
                label={`${trip.title} 정보 다시 불러오기`}
                onPress={() => {
                  /* 같은 계정으로 실패한 조회만 다시 실행한다. */ return void query.refetch();
                }}
                style={s.action}
              >
                <Text style={s.actionText}>다시 불러오기</Text>
              </MyTripsButton>
            )}
          </View>
        )}
        <View style={s.actions}>
          <MyTripsButton
            label={`${trip.title} ${timing.action}`}
            onPress={() => {
              /* 완료 여행은 기존 다이어리로, 나머지는 일정 상세로 이동한다. */ return router.push(
                travelPlanPath(trip),
              );
            }}
            style={[
              s.action,
              s.mainAction,
              timing.phase === 'IN_PROGRESS'
                ? s.primary
                : timing.phase === 'COMPLETED'
                  ? s.warm
                  : s.navy,
            ]}
          >
            <Ionicons
              name={
                timing.phase === 'COMPLETED'
                  ? 'book-outline'
                  : 'calendar-outline'
              }
              size={17}
              color={timing.phase === 'COMPLETED' ? c.ink : c.card}
            />
            <Text
              style={[s.actionText, timing.phase !== 'COMPLETED' && s.inverse]}
            >
              {timing.action}
            </Text>
          </MyTripsButton>
          {timing.phase === 'IN_PROGRESS' && (
            <MyTripsButton
              label={`${trip.title} 비용 보기`}
              onPress={() => {
                /* 실제 비용 탭을 연다. */ return router.push(
                  `/trips/${trip.id}?section=expenses`,
                );
              }}
              style={s.action}
            >
              <Ionicons name="receipt-outline" size={17} color={c.ink} />
              <Text style={s.actionText}>비용</Text>
            </MyTripsButton>
          )}
          <MyTripsButton
            label={`${trip.title} 메뉴 더보기`}
            onPress={() => {
              /* 선택한 여행의 기존 기능만 메뉴로 연다. */ return setMenu(true);
            }}
            style={s.action}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
          </MyTripsButton>
        </View>
      </View>
      <ActionSheet
        visible={menu}
        title={trip.title}
        onClose={() => {
          /* 원본을 바꾸지 않고 메뉴를 닫는다. */ return setMenu(false);
        }}
      >
        <MyTripsButton
          label="여행 일정 보기"
          onPress={() => {
            /* 메뉴를 닫고 일정 원본을 연다. */ return void (setMenu(false),
            router.push(`/trips/${trip.id}`));
          }}
          style={s.action}
        >
          <Text style={s.actionText}>여행 일정 보기</Text>
        </MyTripsButton>
        <MyTripsButton
          label="여행 비용 보기"
          onPress={() => {
            /* 메뉴를 닫고 여행에 연결된 실제 비용을 연다. */ return void (setMenu(
              false,
            ),
            router.push(`/trips/${trip.id}?section=expenses`));
          }}
          style={s.action}
        >
          <Text style={s.actionText}>여행 비용 보기</Text>
        </MyTripsButton>
        <MyTripsButton
          label="공개 범위 관리"
          onPress={() => {
            /* 메뉴를 닫고 확인 절차가 있는 기존 공유 화면을 연다. */ return void (setMenu(
              false,
            ),
            router.push(`/trips/${trip.id}?section=share`));
          }}
          style={s.action}
        >
          <Text style={s.actionText}>공개 범위 관리</Text>
        </MyTripsButton>
      </ActionSheet>
    </View>
  );
}

// 사진이 없는 여행에는 도시 예시 사진 대신 단색 표지를 사용한다.
function MyTripCover({
  trip,
  userId,
  snapshot,
}: {
  trip: PersistedTrip;
  userId: string;
  snapshot?: WorkspaceSnapshot;
}) {
  // 영수증을 대표 사진으로 선택하지 않는다.
  const facts = snapshot ? myTripFacts(snapshot) : undefined;
  const timing = myTripTiming(trip);
  return (
    <View style={[s.cover, timing.phase === 'COMPLETED' && s.completedCover]}>
      {facts?.photo ? (
        <MyTripPhoto
          userId={userId}
          tripId={trip.id}
          mediaId={facts.photo.id}
        />
      ) : (
        <Ionicons
          name="map-outline"
          size={44}
          color="#9BAEC8"
          style={{ position: 'absolute', top: 48, alignSelf: 'center' }}
        />
      )}
      {facts?.photo && (
        <Svg
          width="100%"
          height="100%"
          style={s.coverImage}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`cover-${trip.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#000" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#cover-${trip.id})`} />
        </Svg>
      )}
      <View style={s.coverTop} testID="my-trip-cover-status">
        <View style={s.row}>
          <View style={s.badge}>
            <Text
              style={[
                s.badgeText,
                timing.phase === 'IN_PROGRESS' && s.activeBadge,
              ]}
            >
              {timing.badge}
            </Text>
          </View>
          {timing.countdown && (
            <View style={[s.badge, s.darkBadge]}>
              <Text style={[s.badgeText, s.inverse]}>{timing.countdown}</Text>
            </View>
          )}
        </View>
        {facts && (
          <View
            style={s.badge}
            accessibilityLabel={facts.published ? '공개한 여행' : '비공개 여행'}
          >
            <Ionicons
              name={facts.published ? 'globe-outline' : 'lock-closed-outline'}
              size={15}
              color={c.muted}
            />
          </View>
        )}
      </View>
      <View
        testID="my-trip-cover-summary"
        style={[
          s.coverBottom,
          facts?.photo ? s.coverBottomWithPhoto : undefined,
        ]}
      >
        <View style={s.row}>
          <Ionicons
            name="location-outline"
            size={15}
            color={facts?.photo ? '#FFFFFF' : c.primary}
          />
          <Text
            style={[s.caption, facts?.photo ? s.inverse : { color: c.muted }]}
          >
            {[trip.country, trip.city].filter(Boolean).join(' · ')}
            {timing.total > 0
              ? ` · ${timing.total - 1}박 ${timing.total}일`
              : ''}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={[s.coverTitle, facts?.photo ? s.inverse : { color: c.ink }]}
        >
          {trip.title}
        </Text>
      </View>
    </View>
  );
}

// 기존 비공개 사진 접근 훅으로 원본 한 장만 표시한다.
function MyTripPhoto({
  userId,
  tripId,
  mediaId,
}: {
  userId: string;
  tripId: string;
  mediaId: string;
}) {
  // 실제 다운로드 실패도 다른 사진으로 대체하지 않는다.
  const query = usePrivatePhotoQuery(userId, tripId, mediaId);
  const [failed, setFailed] = useState('');
  return query.data && !query.isError && failed !== query.data ? (
    <Image
      accessibilityLabel="여행에 등록한 표지 사진"
      source={{ uri: query.data }}
      style={s.coverImage}
      resizeMode="cover"
      onError={() => {
        /* 실패한 주소를 계속 정상 표지로 표시하지 않는다. */ return setFailed(
          query.data || '',
        );
      }}
    />
  ) : (
    <View style={{ zIndex: 1, alignSelf: 'center', paddingTop: 40 }}>
      <Text style={s.caption}>
        {query.isError || failed
          ? '사진을 불러오지 못했어요'
          : '사진 불러오는 중…'}
      </Text>
      {(query.isError || failed) && (
        <MyTripsButton
          label="표지 사진 다시 불러오기"
          style={s.action}
          onPress={() => {
            /* 같은 원본의 권한과 다운로드를 다시 확인한다. */ return void (setFailed(
              '',
            ),
            query.refetch());
          }}
        >
          <Text style={s.actionText}>사진 다시 불러오기</Text>
        </MyTripsButton>
      )}
    </View>
  );
}

// 다음 일정·항공·숙소·공개 상태는 준비된 원본 값으로만 표시한다.
function MyTripFactsView({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  // 상태 문구와 진행 여부는 모든 카드에서 같은 날짜 판별을 쓴다.
  const facts = myTripFacts(snapshot);
  const timing = myTripTiming(snapshot.trip);
  return timing.phase === 'IN_PROGRESS' ? (
    <View style={s.panel}>
      <View style={s.wrapRow}>
        <Text style={s.strongCaption}>오늘의 다음 일정</Text>
        <Text style={s.caption}>{facts.next?.timeSlot || ''}</Text>
      </View>
      <Text style={s.body}>
        {facts.next?.title || '남은 일정이 없어요. 여행 일정을 확인해 보세요.'}
      </Text>
    </View>
  ) : timing.phase === 'COMPLETED' ? (
    <View style={s.panel}>
      <Text style={s.body}>
        {facts.published
          ? '발자국에 공개한 여행이에요'
          : '나만의 비공개 아카이브'}
      </Text>
      <Text style={s.caption}>
        사진 {facts.photoCount}장 · 영수증 {facts.receiptCount}건
      </Text>
    </View>
  ) : (
    <View style={s.panelGrid}>
      <View style={s.panelCell}>
        <Text style={s.caption}>항공편</Text>
        <Text style={s.body}>
          {facts.flight
            ? `${facts.flight.departure} → ${facts.flight.arrival}`
            : '등록한 항공편이 없어요'}
        </Text>
      </View>
      <View style={s.panelCell}>
        <Text style={s.caption}>숙소</Text>
        <Text style={s.body}>
          {facts.stay?.title || '등록한 숙소가 없어요'}
        </Text>
      </View>
      {facts.checklistTotal > 0 && (
        <Text style={s.caption}>
          준비물 {facts.checklistTotal}개 중 {facts.checklistDone}개 준비
        </Text>
      )}
    </View>
  );
}
