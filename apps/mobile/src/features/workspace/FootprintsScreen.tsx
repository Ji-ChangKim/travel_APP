import { returnToScreen } from '@/components/navigationModel';
import { tripListQueryOptions, workspaceQueryOptions } from './tripQueries';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { PersistedTrip } from '@wherego/domain';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useTripStore } from '@/stores/useTripStore';

import { Field } from './ui';
import ServerPhoto from './ServerPhoto';

import TripAccessFeedback from './TripAccessFeedback';
import { travelDateRange } from './travelDateRange';
import { diaryCosts } from './diary';
import { useTripDateRefresh } from './useTripDateRefresh';
import {
  completedArchive,
  archiveSummary,
  archiveDetails,
} from './archiveModel';
import { LedgerAction, LedgerScreen, useLedgerWide } from './LedgerUI';
import { ledgerStyles as s } from './ledgerTheme';

// Stitch 보관함을 현재 계정의 실제 여행 목록에 연결한다.
export default function FootprintsScreen() {
  // 날짜 변경과 계정 전환에 같은 완료 판정을 사용한다.
  useTripDateRefresh();
  const user = useTripStore((state) => {
    // 계정별 조회와 게스트의 기기 저장을 구분한다.
    return state.currentUser;
  });
  const userId = user?.id || '';
  const query = useQuery({
    ...tripListQueryOptions(userId),
    enabled: Boolean(userId),
  });
  return (
    <ArchiveContent
      key={userId || 'public'}
      userId={userId}
      local={user?.authProvider === 'guest'}
      query={query}
    />
  );
}

// 필터·통계·빈 결과는 조회 성공한 원본에서만 파생한다.
function ArchiveContent({
  userId,
  local,
  query,
}: {
  userId: string;
  local: boolean;
  query: UseQueryResult<PersistedTrip[], Error>;
}) {
  // 검색·연도 변경은 여행 원본을 수정하지 않는다.
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const wide = useLedgerWide();
  const router = useRouter();
  const trips = completedArchive(query.isSuccess ? query.data : []);
  const summary = archiveSummary(trips);
  const years = [
    ...new Set(
      trips.map((trip) => {
        // 실제 여행 연도만 필터에 표시한다.
        return trip.startDate.slice(0, 4);
      }),
    ),
  ]
    .sort()
    .reverse();
  const filtered = trips.filter((trip) => {
    // 실제 이름·나라·도시와 연도를 함께 검색한다.
    return (
      (!year || trip.startDate.startsWith(year)) &&
      `${trip.title} ${trip.country} ${trip.city}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    );
  });
  return (
    <LedgerScreen
      title="나의 발자국"
      onBack={() => {
        // 개인 보관함을 연 출발 화면으로 돌아간다.
        return returnToScreen(router, '/(tabs)/my');
      }}
    >
      <ScrollView contentContainerStyle={[s.content, wide && s.wideContent]}>
        <View style={s.tinted}>
          <Text style={s.eyebrow}>다녀온 여행 모음</Text>
          <Text accessibilityRole="header" style={s.title}>
            {query.isSuccess
              ? `다녀온 여행의 발자국 ${summary.trips}개`
              : '다녀온 여행의 발자국'}
          </Text>
          <Text style={s.meta}>
            걸어온 길마다 소중한 추억을 온전히 담아두었어요.
          </Text>
          {query.isSuccess && (
            <View style={[s.row, { justifyContent: 'space-around' }]}>
              {[
                ['방문 도시', summary.cities],
                ['다녀온 여행', summary.trips],
                ['방문 국가', summary.countries],
              ].map(([label, count]) => {
                // 숫자는 실제 완료 여행 목록에서 계산한다.
                return (
                  <View
                    key={String(label)}
                    style={{ alignItems: 'center', gap: 4 }}
                  >
                    <Text style={s.meta}>{label}</Text>
                    <Text style={s.section}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <LedgerAction
          label={userId ? '다녀온 여행 추가' : '로그인하고 여행 기록 시작'}
          primary
          onPress={() => {
            // 실제 생성 또는 목적 복귀가 있는 로그인으로 연결한다.
            return router.push(
              userId ? '/new-trip?mode=record' : '/login?next=my-footprints',
            );
          }}
        />
        {local && (
          <Text style={s.meta}>
            이 기록은 이 기기에 보관돼요. 앱이나 기기 데이터를 지우면 사라질 수
            있어요.
          </Text>
        )}
        {query.isPending && userId ? (
          <HaruState
            kind="loading"
            title="여행 기록을 불러오고 있어요"
            compact
          />
        ) : null}
        {query.isError && (
          <TripAccessFeedback
            error={query.error}
            target={{ next: 'my-footprints' }}
            busy={query.isFetching}
            onRetry={() => {
              // 현재 계정의 실패한 목록만 다시 요청한다.
              return void query.refetch();
            }}
          />
        )}
        {query.isSuccess && trips.length > 0 && (
          <>
            <Field
              label="여행 기록 검색"
              value={search}
              placeholder="여행 이름, 도시, 국가"
              onChange={setSearch}
            />
            <View style={s.row}>
              <LedgerAction
                label={`전체 ${trips.length}`}
                selected={!year}
                onPress={() => {
                  // 전체 결과로 되돌린다.
                  return setYear('');
                }}
              />
              {years.map((value) => {
                // 저장된 연도의 실제 여행 수만 표시한다.
                return (
                  <LedgerAction
                    key={value}
                    label={`${value}년 ${
                      trips.filter((trip) => {
                        // 같은 연도 경계를 사용한다.
                        return trip.startDate.startsWith(value);
                      }).length
                    }`}
                    selected={year === value}
                    onPress={() => {
                      // 연도 선택은 읽기 필터만 바꾼다.
                      return setYear(value);
                    }}
                  />
                );
              })}
            </View>
            {!filtered.length && (
              <HaruState
                kind="empty"
                title="조건에 맞는 여행이 없어요"
                description="검색어나 연도를 바꿔 다시 찾아보세요."
              />
            )}
            <View style={[s.row, { alignItems: 'stretch' }]}>
              {filtered.slice(0, limit).map((trip) => {
                // 상세는 한 번에12개씩 표시해 전체 사진의 동시 조회를 줄인다.
                return (
                  <View
                    key={trip.id}
                    style={{ width: wide ? '48%' : '100%', flexGrow: 1 }}
                  >
                    <ArchiveCard trip={trip} userId={userId} />
                  </View>
                );
              })}
            </View>
            {filtered.length > limit && (
              <LedgerAction
                label="여행 기록 더 보기"
                onPress={() => {
                  // 요청한 다음 묶음만 표시한다.
                  return setLimit(limit + 12);
                }}
              />
            )}
          </>
        )}
        {query.isSuccess && !trips.length && (
          <View style={s.card}>
            <HaruState
              kind="empty"
              title="아직 남긴 발자국이 없어요"
              description="다녀온 여행의 날짜와 장소를 등록하고 사진과 지출을 한곳에 모아보세요."
            />
            <LedgerAction
              label="내 여행 살펴보기"
              onPress={() => {
                // 예정 여행은 기존 내 여행에서 이어간다.
                return router.push('/plans');
              }}
            />
          </View>
        )}
      </ScrollView>
    </LedgerScreen>
  );
}

// 카드의 사진·지출·공개 상태는 실제 상세 응답이 있어야 표시한다.
function ArchiveCard({
  trip,
  userId,
}: {
  trip: PersistedTrip;
  userId: string;
}) {
  // 다이어리와 조회 키를 공유한다.
  const query = useQuery({ ...workspaceQueryOptions(userId, trip.id) });
  const router = useRouter();
  const snapshot = query.isError ? undefined : query.data;
  const detail = snapshot ? archiveDetails(snapshot) : undefined;
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>
        {snapshot?.postId ? '공개 사본 있음 · 개인 원본' : '여행 완료'}
      </Text>
      <Text accessibilityRole="header" style={s.section}>
        {trip.title}
      </Text>
      <Text style={s.meta}>
        {[trip.country, trip.city].filter(Boolean).join(' · ')}
      </Text>
      <Text style={s.meta}>
        {travelDateRange(trip.startDate, trip.endDate)}
      </Text>
      <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'stretch' }]}>
        {detail?.photos.slice(0, 3).map((photo) => {
          // 실제 일반 사진만 보여주고 예시 이미지로 대체하지 않는다.
          return (
            <View key={photo.id} style={{ flex: 1, minWidth: 0 }}>
              <ServerPhoto
                userId={userId}
                tripId={trip.id}
                mediaId={photo.id}
              />
            </View>
          );
        })}
      </View>
      {query.isPending && (
        <Text style={s.meta}>사진과 기록을 불러오고 있어요.</Text>
      )}
      {query.isError && (
        <LedgerAction
          label="기록 정보 다시 불러오기"
          onPress={() => {
            // 실패를 사진0장이나 지출0원으로 표시하지 않는다.
            return void query.refetch();
          }}
        />
      )}
      {detail && (
        <View style={s.tinted}>
          <Text style={s.meta}>
            사진 {detail.photos.length}장 · 일정 {detail.schedules}개 · 영수증{' '}
            {detail.receipts}장
          </Text>
          {diaryCosts(snapshot!.expenses).map((cost) => {
            // 서로 다른 통화와 예상 지출을 합치지 않는다.
            return (
              <Text key={cost.currency} style={s.body}>
                {cost.currency} {cost.amount}
              </Text>
            );
          })}
        </View>
      )}
      <LedgerAction
        label="기록 열기"
        accessibilityLabel={`${trip.title} 기록 열기`}
        onPress={() => {
          // 해당 여행의 멤버 원본을 연다.
          return router.push(`/diary/${trip.id}`);
        }}
      />
    </View>
  );
}
