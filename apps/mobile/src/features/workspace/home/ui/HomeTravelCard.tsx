import { Ionicons } from '@expo/vector-icons';
import { discoveryDestinations, type WorkspaceSnapshot } from '@wherego/domain';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { cityGuides } from '../../community/model/cityGuides';
import { scheduleKind } from '../../schedule/model/schedulePresentation';
import { useMyTripDetails } from '../../my-trips/manager/useMyTripDetails';
import { usePrivatePhotoQuery } from '../../schedule/manager/usePrivatePhoto';
import { homePalette, homeTravelStyles as s } from '../styles/homeTravelStyles';
import { homeDaysLeft, type HomeTravel } from '../model/homeTravelModel';

export const DESTINATION_PHOTOS: Record<string, any> = {
  osaka: require('../../../../../assets/destinations/osaka.jpg'),
  tokyo: require('../../../../../assets/destinations/tokyo.jpg'),
  danang: require('../../../../../assets/destinations/danang.jpg'),
  bangkok: require('../../../../../assets/destinations/bangkok.jpg'),
  taipei: require('../../../../../assets/destinations/taipei.jpg'),
  singapore: require('../../../../../assets/destinations/singapore.jpg'),
  nagoya: require('../../../../../assets/destinations/nagoya.jpg'),
  shanghai: require('../../../../../assets/destinations/shanghai.jpg'),
};

// 도시 이름이나 여행 제목에서 대표 도시 배경 이미지를 선택한다.
export function getDestinationPhoto(cityOrTitle: string) {
  // 영문·한글 도시 키워드를 소문자로 정규화해 매칭한다.
  const text = cityOrTitle.toLowerCase();
  if (text.includes('오사카') || text.includes('osaka'))
    return DESTINATION_PHOTOS.osaka;
  if (text.includes('도쿄') || text.includes('tokyo'))
    return DESTINATION_PHOTOS.tokyo;
  if (text.includes('다낭') || text.includes('danang'))
    return DESTINATION_PHOTOS.danang;
  if (text.includes('방콕') || text.includes('bangkok'))
    return DESTINATION_PHOTOS.bangkok;
  if (
    text.includes('타이베이') ||
    text.includes('taipei') ||
    text.includes('대만')
  )
    return DESTINATION_PHOTOS.taipei;
  if (text.includes('싱가포르') || text.includes('singapore'))
    return DESTINATION_PHOTOS.singapore;
  if (text.includes('나고야') || text.includes('nagoya'))
    return DESTINATION_PHOTOS.nagoya;
  if (text.includes('상하이') || text.includes('shanghai'))
    return DESTINATION_PHOTOS.shanghai;
  return DESTINATION_PHOTOS.osaka;
}

// 여행의 도시·제목과 일치하는 공식 추천 여행지 가이드를 찾는다.
export function matchDiscoveryDestination(city: string, title: string) {
  // 도시명과 제목을 합쳐 등록된 추천 목적지 키·이름과 대조한다.
  const target = `${city} ${title}`.toLowerCase();
  return discoveryDestinations.find((dest) => {
    // 한글 도시명 또는 영문 키가 포함되면 해당 목적지를 반환한다.
    return (
      target.includes(dest.city.toLowerCase()) ||
      target.includes(dest.key.toLowerCase())
    );
  });
}

// 워크스페이스 스냅샷에서 가장 먼저 실행할 첫 일정을 정렬해 반환한다.
function pickFirstStop(snapshot: WorkspaceSnapshot | undefined) {
  // 스냅샷이나 등록된 세부 일정이 없으면 null을 반환한다.
  if (!snapshot || snapshot.itinerary.length === 0) return null;
  const dayNumberById = new Map(
    snapshot.days.map((day) => {
      // 각 날짜 ID를 DAY 번호에 매핑한다.
      return [day.id, day.dayNumber] as const;
    }),
  );
  const sorted = [...snapshot.itinerary].sort((a, b) => {
    // DAY 번호 오름차순, 동일 DAY 내에서는 정렬 순서 오름차순으로 비교한다.
    return (
      (dayNumberById.get(a.dayId) || 1) - (dayNumberById.get(b.dayId) || 1) ||
      a.sortOrder - b.sortOrder
    );
  });
  const first = sorted[0];
  if (!first) return null;
  return {
    entry: first,
    dayNumber: dayNumberById.get(first.dayId) || 1,
  };
}

// 초안은 복원으로, 서버 여행은 실제 일정과 권한을 확인한 컨시어지 카드로 연결한다.
export default function HomeTravelCard({
  item,
  userId,
  hero = false,
  inTrip = false,
  onOpen,
}: {
  item: HomeTravel;
  userId: string;
  hero?: boolean;
  inTrip?: boolean;
  onOpen?: () => void;
}) {
  useLocale();
  // 라우터·접근성 배율·상세 스냅샷 조회 상태를 준비한다.
  const router = useRouter();
  const large = useAppAccessibility().largeText;
  const query = useMyTripDetails(userId, item.trip ? item.id : '');
  const snapshot = query.isError ? undefined : query.data;
  const photo = snapshot?.media.find((media) => {
    // 대표 커버로 쓸 사진 미디어를 찾는다.
    return media.purpose === 'photo';
  });
  const title = item.title || t('새 여행 계획');
  const date = item.startDate
    ? [item.startDate, item.endDate].filter(Boolean).join(' ~ ')
    : t('날짜 미정');
  const dDay = homeDaysLeft(item);
  const dDayLabel =
    dDay === 0 ? 'D-DAY' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
  const destinationPhoto = getDestinationPhoto(item.city || item.title || '');

  // 카드를 눌렀을 때 초안이면 이어쓰기, 정식 여행이면 상세 화면으로 이동한다.
  function open() {
    // 상위 닫기 콜백이 있으면 먼저 실행한 뒤 경로를 이동한다.
    onOpen?.();
    router.push(
      item.draft
        ? { pathname: '/new-trip', params: { resume: item.id } }
        : `/trips/${item.id}`,
    );
  }
  const cover = photo ? (
    <HomeTravelPhoto userId={userId} tripId={item.id} mediaId={photo.id} />
  ) : null;

  if (inTrip) {
    return (
      <HomeInTripCard
        item={item}
        title={title}
        date={date}
        dDay={dDay}
        snapshot={snapshot}
        onOpen={open}
        onOpenExpenses={() => {
          // 여행 중·다녀온 뒤 영수증 촬영·업로드 시트로 1단계 진입한다.
          router.push({
            pathname: '/trips/[id]',
            params: { id: item.id, section: 'expenses', receiptCapture: '1' },
          });
        }}
      />
    );
  }

  return (
    <View testID={`home-travel-${item.id}`} style={s.conciergeCard}>
      {hero ? (
        <HomeHeroCard
          item={item}
          userId={userId}
          title={title}
          date={date}
          dDayLabel={dDayLabel}
          snapshot={snapshot}
          isError={query.isError}
          onRefetch={() => {
            // 상세 조회가 실패했을 때 다시 요청한다.
            void query.refetch();
          }}
          onOpen={open}
          onOpenMap={() => {
            // 동선 및 티켓 확인을 위해 여행 상세 화면으로 이동한다.
            router.push({
              pathname: '/trips/[id]',
              params: { id: item.id, section: 'map' },
            });
          }}
          onInvite={() => {
            // 동행자 초대 패널로 바로 이동한다.
            router.push({
              pathname: '/trips/[id]',
              params: { id: item.id, section: 'companions' },
            });
          }}
          onOpenGuide={(key) => {
            // 선택한 도시의 공식 여행 가이드 페이지로 이동한다.
            router.push(`/destinations/${key}`);
          }}
        />
      ) : (
        <View
          style={[
            s.row,
            large && { flexDirection: 'column', alignItems: 'stretch' },
          ]}
        >
          {item.startDate && !item.draft && (
            <View style={[s.image, s.thumb, { overflow: 'hidden' }]}>
              {cover ? (
                cover
              ) : (
                <Image
                  source={destinationPhoto}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessible={false}
                />
              )}
              <Text style={[s.date, { margin: 6 }]}>
                {homeDaysLeft(item) >= 0
                  ? `D-${homeDaysLeft(item)}`
                  : t('여행 중')}
              </Text>
            </View>
          )}
          <View style={s.copy}>
            <Text style={s.meta}>{date}</Text>
            <Text style={s.rowTitle}>{title}</Text>
            {item.draft && (
              <Text style={s.meta}>{t('계정에 저장한 작성 중인 계획')}</Text>
            )}
            <DesignButton
              label={
                item.draft || !item.startDate
                  ? t('이어서 계획')
                  : t('일정 보기')
              }
              variant="quiet"
              onPress={open}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// 퍼스트 폴드 대표 여행을 시안의 '다음 일정 컨시어지' 카드로 렌더링한다.
function HomeHeroCard({
  item,
  userId,
  title,
  date,
  dDayLabel,
  snapshot,
  isError,
  onRefetch,
  onOpen,
  onOpenMap,
  onInvite,
  onOpenGuide,
}: {
  item: HomeTravel;
  userId: string;
  title: string;
  date: string;
  dDayLabel: string;
  snapshot: WorkspaceSnapshot | undefined;
  isError: boolean;
  onRefetch: () => void;
  onOpen: () => void;
  onOpenMap: () => void;
  onInvite: () => void;
  onOpenGuide: (key: string) => void;
}) {
  // 첫 동선 일정과 항공·숙소 등록 여부를 계산해 컨시어지 요약 문구를 만든다.
  const firstStop = pickFirstStop(snapshot);
  const itineraryCount = snapshot?.itinerary.length ?? 0;
  const hasFlight = Boolean(
    snapshot?.itinerary.some((entry) => {
      // 항공편 정보가 있는 일정이 존재하는지 확인한다.
      return Boolean(entry.flight);
    }),
  );
  const hasStay = Boolean(
    snapshot?.itinerary.some((entry) => {
      // 숙소 유형 일정이 존재하는지 확인한다.
      return entry.type === 'STAY';
    }),
  );
  const companionCount = snapshot
    ? snapshot.members.filter((member) => {
        // 본인 외 동행자 수를 계산한다.
        return member.userId !== userId;
      }).length
    : 0;
  const statusSummary = snapshot
    ? itineraryCount > 0
      ? `${t('총 {p0}개 일정', { p0: itineraryCount })} · ${
          hasFlight
            ? t('항공편 등록')
            : hasStay
              ? t('숙소 일정 등록')
              : t('동선 준비 완료')
        }`
      : t('일정 0개 · 첫 장소를 추가해 보세요')
    : [item.country, item.city, dDayLabel].filter(Boolean).join(' · ');

  return (
    <>
      <View style={s.conciergeTop}>
        <View style={s.conciergeHeaderRow}>
          <View style={s.conciergePill}>
            <Text style={s.conciergePillText}>{t('다음 일정 컨시어지')}</Text>
          </View>
          <Text style={s.conciergeMetaText}>{statusSummary}</Text>
        </View>

        <Text style={s.conciergeTitle}>{title}</Text>
        <Text style={s.conciergeSubText}>
          📅 {date}
          {companionCount > 0
            ? ` · ${t('동행 {p0}명', { p0: companionCount })}`
            : item.city
              ? ` · ${[item.country, item.city].filter(Boolean).join(' ')}`
              : ''}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            firstStop
              ? `Day ${firstStop.dayNumber} ${firstStop.entry.title}`
              : t('첫 일정 추가하기')
          }
          onPress={onOpen}
          style={({ pressed }) => [
            s.conciergeStepBox,
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={s.conciergeStepIcon} accessible={false}>
            <Ionicons
              name={firstStop ? 'time-outline' : 'add-circle-outline'}
              size={18}
              color="#FFFFFF"
              accessible={false}
            />
          </View>
          <View style={s.conciergeStepBody}>
            <View style={s.conciergeStepTopRow}>
              <Text style={s.conciergeStepTime}>
                {firstStop
                  ? `Day ${firstStop.dayNumber}${
                      firstStop.entry.timeSlot
                        ? ` · ${firstStop.entry.timeSlot}`
                        : ''
                    }`
                  : t('Day 1 · 첫 일정 비어 있음')}
              </Text>
              <View style={s.conciergeStepTag}>
                <Text style={s.conciergeStepTagText}>
                  {firstStop ? t('첫 동선') : t('일정 비어 있음')}
                </Text>
              </View>
            </View>
            <Text style={s.conciergeStepTitle} numberOfLines={2}>
              {firstStop
                ? firstStop.entry.title
                : t(
                    '도착 공항이나 첫 방문 장소를 추가해 나만의 동선을 시작해 보세요',
                  )}
            </Text>
          </View>
        </Pressable>

        {item.draft && (
          <Text style={s.meta}>{t('계정에 저장한 작성 중인 계획')}</Text>
        )}
        {isError && (
          <DesignButton
            label={t('여행 정보 다시 불러오기')}
            variant="quiet"
            onPress={onRefetch}
          />
        )}
      </View>

      <View style={s.conciergeBottom}>
        <View style={s.conciergeBtnRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.draft ? t('이어서 계획') : t('일정 보기')}
            style={({ pressed }) => [
              s.conciergePrimaryBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={onOpen}
          >
            <Text style={s.conciergePrimaryBtnText} accessible={false}>
              {item.draft
                ? t('이어서 계획')
                : snapshot && itineraryCount === 0
                  ? t('첫 일정 채우기')
                  : t('내 일정 전체보기')}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color="#FFFFFF"
              accessible={false}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('오프라인 티켓/동선')}
            style={({ pressed }) => [
              s.conciergeSecondaryBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={onOpenMap}
          >
            <Ionicons
              name="ticket-outline"
              size={16}
              color={homePalette.coralDeep}
              accessible={false}
            />
            <Text style={s.conciergeSecondaryBtnText} accessible={false}>
              {t('오프라인 티켓/동선')}
            </Text>
          </Pressable>
        </View>

        {snapshot?.myRole === 'owner' && (
          <View style={s.conciergeSubActionRow}>
            <Text style={s.meta}>
              {t('동행자와 실시간으로 일정·가계부를 함께 볼 수 있어요')}
            </Text>
            <DesignButton
              label={t('친구 초대')}
              variant="quiet"
              onPress={onInvite}
            />
          </View>
        )}
      </View>

      {snapshot && snapshot.itinerary.length > 1 && (
        <HomeHeroHighlights snapshot={snapshot} onOpen={onOpen} />
      )}
      <HomeDestinationWidget
        city={item.city}
        title={title}
        onOpenGuide={onOpenGuide}
      />
    </>
  );
}

// 다수의 세부 일정이 있을 때 가로 타임라인 칩으로 주요 하이라이트를 보여준다.
function HomeHeroHighlights({
  snapshot,
  onOpen,
}: {
  snapshot: WorkspaceSnapshot;
  onOpen: () => void;
}) {
  // DAY 번호와 정렬 순서에 따라 최대 5개의 주요 일정을 추출한다.
  const dayNumberById = new Map(
    snapshot.days.map((day) => {
      // 각 날짜 ID를 DAY 번호에 연결한다.
      return [day.id, day.dayNumber] as const;
    }),
  );
  const highlights = [...snapshot.itinerary]
    .sort((a, b) => {
      // 빠른 날짜와 순서를 먼저 배치한다.
      return (
        (dayNumberById.get(a.dayId) || 1) - (dayNumberById.get(b.dayId) || 1) ||
        a.sortOrder - b.sortOrder
      );
    })
    .slice(0, 5);
  return (
    <View style={s.highlightSection}>
      <View style={s.subHeaderRow}>
        <Text style={s.subHeaderTitle}>{t('주요 일정 하이라이트')}</Text>
        <Text style={s.subHeaderLink}>
          {t('총 {p0}개 일정', { p0: snapshot.itinerary.length })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.timelineHorizontal}
      >
        {highlights.map((entry) => {
          // 각 일정 카드에 DAY 번호와 시간·장소명을 표시한다.
          const dayNum = dayNumberById.get(entry.dayId) || 1;
          return (
            <Pressable
              key={entry.id}
              style={s.dayCard}
              onPress={onOpen}
              accessible={false}
            >
              <Text style={s.dayTag}>
                DAY {dayNum}
                {entry.timeSlot ? ` · ${entry.timeSlot}` : ''}
              </Text>
              <Text style={s.daySpotName} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={s.dayMeta} numberOfLines={1}>
                {entry.address ||
                  entry.memo ||
                  t(scheduleKind(entry.type).label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// 여행 도시와 일치하는 관광청 공식 추천 시기와 명소 요약을 카드 하단에 제공한다.
function HomeDestinationWidget({
  city,
  title,
  onOpenGuide,
}: {
  city: string;
  title: string;
  onOpenGuide: (key: string) => void;
}) {
  // 매칭되는 공식 추천 도시가 없으면 위젯을 생략한다.
  const dest = matchDiscoveryDestination(city, title);
  if (!dest) return null;
  const guide = cityGuides[dest.key];
  if (!guide) return null;
  return (
    <View style={s.contextWidget}>
      <View style={s.subHeaderRow}>
        <Text style={s.subHeaderTitle}>
          📍 {dest.city} {t('여행 실용 정보')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('{p0} 도시 가이드 보기', { p0: dest.city })}
          onPress={() => {
            // 해당 도시의 공식 가이드 상세 화면을 연다.
            onOpenGuide(dest.key);
          }}
          style={{
            minHeight: 36,
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={s.subHeaderLink}>{t('도시 가이드 →')}</Text>
        </Pressable>
      </View>
      <View style={s.widgetGrid}>
        <View style={s.widgetBox}>
          <Text style={s.widgetLabel}>{t('추천 방문 시기')}</Text>
          <Text style={s.widgetVal}>{guide.seasons[0]?.months || '-'}</Text>
        </View>
        <View style={s.widgetBox}>
          <Text style={s.widgetLabel}>{t('대표 명소 · 미식')}</Text>
          <Text style={s.widgetVal} numberOfLines={1}>
            {[guide.places[0]?.title, guide.foods[0]?.title]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// 여행 중인 여정을 현지 진행 컨시어지 및 영수증 즉시 기록 카드로 렌더링한다.
function HomeInTripCard({
  item,
  title,
  date,
  dDay,
  snapshot,
  onOpen,
  onOpenExpenses,
}: {
  item: HomeTravel;
  title: string;
  date: string;
  dDay: number;
  snapshot: WorkspaceSnapshot | undefined;
  onOpen: () => void;
  onOpenExpenses: () => void;
}) {
  // 경과 일수와 첫 일정·영수증 목록을 계산한다.
  const dayElapsed = Math.max(1, Math.abs(dDay) + 1);
  const receipts = snapshot?.receipts || [];
  const firstStop = pickFirstStop(snapshot);
  return (
    <View testID={`home-travel-${item.id}`} style={s.conciergeCard}>
      <View style={s.conciergeTop}>
        <View style={s.conciergeHeaderRow}>
          <View style={s.conciergePill}>
            <Text style={s.conciergePillText}>
              {t('현지 동행 컨시어지')} · {t('{p0}일차', { p0: dayElapsed })}
            </Text>
          </View>
          <Text style={s.conciergeMetaText}>
            {snapshot
              ? t('총 {p0}개 일정', { p0: snapshot.itinerary.length })
              : t('여행 중')}
          </Text>
        </View>

        <Text style={s.conciergeTitle}>{title}</Text>
        <Text style={s.conciergeSubText}>📅 {date}</Text>

        <View style={s.conciergeStepBox}>
          <View style={s.conciergeStepIcon} accessible={false}>
            <Ionicons
              name="navigate-outline"
              size={18}
              color="#FFFFFF"
              accessible={false}
            />
          </View>
          <View style={s.conciergeStepBody}>
            <View style={s.conciergeStepTopRow}>
              <Text style={s.conciergeStepTime}>
                {firstStop
                  ? `Day ${firstStop.dayNumber}${
                      firstStop.entry.timeSlot
                        ? ` · ${firstStop.entry.timeSlot}`
                        : ''
                    }`
                  : t('{p0}일차 진행 중', { p0: dayElapsed })}
              </Text>
              <View style={s.conciergeStepTag}>
                <Text style={s.conciergeStepTagText}>
                  {firstStop ? t('진행 동선') : t('영수증 기록')}
                </Text>
              </View>
            </View>
            <Text style={s.conciergeStepTitle} numberOfLines={2}>
              {firstStop
                ? firstStop.entry.title
                : t(
                    '방금 결제한 영수증을 찍어 방문 장소와 지출 내역을 정리해 보세요',
                  )}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.conciergeBottom}>
        <View style={s.conciergeBtnRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('영수증 촬영 및 업로드')}
            style={({ pressed }) => [
              s.conciergePrimaryBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={onOpenExpenses}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color="#FFFFFF"
              accessible={false}
            />
            <Text style={s.conciergePrimaryBtnText} accessible={false}>
              {t('영수증으로 기록하기')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('일정 보기')}
            style={({ pressed }) => [
              s.conciergeSecondaryBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={onOpen}
          >
            <Text style={s.conciergeSecondaryBtnText} accessible={false}>
              {t('내 일정 전체보기')}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color={homePalette.coralDeep}
              accessible={false}
            />
          </Pressable>
        </View>

        {receipts.length > 0 && (
          <View style={{ gap: 8, paddingTop: 6 }}>
            <View style={s.subHeaderRow}>
              <Text style={s.subHeaderTitle}>
                {t('저장한 영수증')} ({receipts.length})
              </Text>
            </View>
            {receipts.slice(0, 2).map((receipt) => {
              // 최근 등록한 영수증 상호명과 금액을 요약해 보여준다.
              return (
                <View key={receipt.id} style={s.receiptFeedCard}>
                  <View style={s.receiptFeedLeft}>
                    <View style={s.receiptFeedIcon} accessible={false}>
                      <Text style={{ fontSize: 16 }} accessible={false}>
                        🧾
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.receiptMerchant} numberOfLines={1}>
                        {receipt.merchant}
                      </Text>
                      <Text style={s.meta}>{receipt.date}</Text>
                    </View>
                  </View>
                  <Text style={s.receiptAmount}>
                    {receipt.currency}{' '}
                    {new Intl.NumberFormat(getLocale(), {
                      maximumFractionDigits: 2,
                    }).format(Number(receipt.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// 개인 사진은 기존 권한 검사와 서명 주소를 사용하고 실패하면 중립 바탕을 남긴다.
function HomeTravelPhoto({
  userId,
  tripId,
  mediaId,
}: {
  userId: string;
  tripId: string;
  mediaId: string;
}) {
  // 서명된 비공개 이미지 주소를 조회하고 로드 실패 시 폴백을 유지한다.
  const query = usePrivatePhotoQuery(userId, tripId, mediaId);
  const [failed, setFailed] = useState('');
  return query.data && !query.isError && failed !== query.data ? (
    <Image
      accessible={false}
      source={{ uri: query.data }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => {
        // 이미지 로드 실패 시 실패한 URL을 기록해 깨진 아이콘을 숨긴다.
        setFailed(query.data || '');
      }}
    />
  ) : null;
}
