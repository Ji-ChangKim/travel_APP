import { Ionicons } from '@expo/vector-icons';
import { discoveryDestinations, type WorkspaceSnapshot } from '@wherego/domain';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { cityGuides } from './cityGuides';
import { scheduleFlight } from './flightModel';
import { scheduleKind } from './schedule/model/schedulePresentation';
import { useMyTripDetails } from './useMyTripDetails';
import { usePrivatePhotoQuery } from './schedule/manager/usePrivatePhoto';
import { homeTravelStyles as s } from './homeTravelStyles';
import { homeDaysLeft, type HomeTravel } from './homeTravelModel';

export const DESTINATION_PHOTOS: Record<string, any> = {
  osaka: require('../../../assets/destinations/osaka.jpg'),
  tokyo: require('../../../assets/destinations/tokyo.jpg'),
  danang: require('../../../assets/destinations/danang.jpg'),
  bangkok: require('../../../assets/destinations/bangkok.jpg'),
  taipei: require('../../../assets/destinations/taipei.jpg'),
  singapore: require('../../../assets/destinations/singapore.jpg'),
  nagoya: require('../../../assets/destinations/nagoya.jpg'),
  shanghai: require('../../../assets/destinations/shanghai.jpg'),
};

const CITY_AIRPORT_CODES: Record<string, string> = {
  오사카: 'KIX',
  도쿄: 'NRT',
  후쿠오카: 'FUK',
  삿포로: 'CTS',
  나고야: 'NGO',
  교토: 'KIX',
  다낭: 'DAD',
  방콕: 'BKK',
  타이베이: 'TPE',
  싱가포르: 'SIN',
  상하이: 'PVG',
  파리: 'CDG',
  런던: 'LHR',
  뉴욕: 'JFK',
  로스앤젤레스: 'LAX',
  제주: 'CJU',
  부산: 'PUS',
  서울: 'ICN',
};

export function getDestinationPhoto(cityOrTitle: string) {
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

function matchDiscoveryDestination(city: string, title: string) {
  const target = `${city} ${title}`.toLowerCase();
  return discoveryDestinations.find(
    (dest) =>
      target.includes(dest.city.toLowerCase()) ||
      target.includes(dest.key.toLowerCase()),
  );
}

// 초안은 복원으로, 서버 여행은 실제 일정과 권한을 확인한 동행 화면으로 연결한다.
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
  const router = useRouter();
  const large = useAppAccessibility().largeText;
  const query = useMyTripDetails(userId, item.trip ? item.id : '');
  const snapshot = query.isError ? undefined : query.data;
  const photo = snapshot?.media.find((media) => media.purpose === 'photo');
  const title = item.title || t('새 여행 계획');
  const date = item.startDate
    ? [item.startDate, item.endDate].filter(Boolean).join(' ~ ')
    : t('날짜 미정');
  const dDay = homeDaysLeft(item);
  const dDayLabel =
    dDay === 0 ? 'D-DAY' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
  const destinationPhoto = getDestinationPhoto(item.city || item.title || '');
  const firstFlight = snapshot?.itinerary
    .map((entry) => scheduleFlight(entry))
    .find(Boolean);
  const departureCode = firstFlight?.departure || 'ICN';
  const arrivalCode =
    firstFlight?.arrival || CITY_AIRPORT_CODES[item.city || ''] || 'KIX';

  function open() {
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
        onOpenExpenses={() =>
          router.push({
            pathname: '/trips/[id]',
            params: { id: item.id, section: 'expenses' },
          })
        }
      />
    );
  }

  return (
    <View testID={`home-travel-${item.id}`} style={s.card}>
      {hero ? (
        <HomeHeroCard
          item={item}
          userId={userId}
          title={title}
          date={date}
          dDayLabel={dDayLabel}
          departureCode={departureCode}
          arrivalCode={arrivalCode}
          destinationPhoto={destinationPhoto}
          cover={cover}
          snapshot={snapshot}
          isError={query.isError}
          onRefetch={() => void query.refetch()}
          onOpen={open}
          onInvite={() =>
            router.push({
              pathname: '/trips/[id]',
              params: { id: item.id, section: 'companions' },
            })
          }
          onOpenGuide={(key) => router.push(`/destinations/${key}`)}
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

function HomeHeroCard({
  item,
  userId,
  title,
  date,
  dDayLabel,
  departureCode,
  arrivalCode,
  destinationPhoto,
  cover,
  snapshot,
  isError,
  onRefetch,
  onOpen,
  onInvite,
  onOpenGuide,
}: {
  item: HomeTravel;
  userId: string;
  title: string;
  date: string;
  dDayLabel: string;
  departureCode: string;
  arrivalCode: string;
  destinationPhoto: any;
  cover: ReactNode;
  snapshot: WorkspaceSnapshot | undefined;
  isError: boolean;
  onRefetch: () => void;
  onOpen: () => void;
  onInvite: () => void;
  onOpenGuide: (key: string) => void;
}) {
  return (
    <>
      <View style={[s.image, s.hero]}>
        {cover ? (
          cover
        ) : (
          <Image
            source={destinationPhoto}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={item.city || title}
          />
        )}
        <View style={s.heroScrim} pointerEvents="none" />
        <View style={s.ticketTopRow}>
          <View style={s.dDayBadge}>
            <Text style={s.dDayText}>{dDayLabel}</Text>
          </View>
          <View style={s.flightRoute}>
            <Text style={s.airportCode}>{departureCode}</Text>
            <Ionicons
              name="airplane"
              size={12}
              color="rgba(255, 255, 255, 0.85)"
              style={{ marginHorizontal: 4 }}
            />
            <Text style={s.airportCode}>{arrivalCode}</Text>
          </View>
        </View>
        <View style={s.ticketMainInfo}>
          <Text style={s.ticketCityLabel}>
            {[item.country, item.city].filter(Boolean).join(' · ')}
          </Text>
          <Text style={s.heroTitle}>{title}</Text>
          <View style={s.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color="rgba(255, 255, 255, 0.9)"
            />
            <Text style={s.date}>{date}</Text>
          </View>
        </View>
      </View>
      <View style={s.ticketNotchRow} accessible={false}>
        <View style={s.ticketNotchLeft} accessible={false} />
        <View style={s.ticketPerforation} accessible={false} />
        <View style={s.ticketNotchRight} accessible={false} />
      </View>
      <View style={s.cardBody}>
        <View style={s.ticketBottomRow}>
          <View style={s.ticketDates}>
            <Text style={s.ticketDateMain}>📅 {date}</Text>
            <Text style={s.ticketDateSub}>
              {snapshot
                ? `${t('동행 {p0}명', {
                    p0: snapshot.members.filter(
                      (member) => member.userId !== userId,
                    ).length,
                  })} · ${t('총 {p0}개 일정', {
                    p0: snapshot.itinerary.length,
                  })}`
                : [item.country, item.city].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={s.tags}>
            {[item.country, item.city].filter(Boolean).map((value, index) => (
              <Text key={`${value}:${index}`} style={s.tag}>
                {value}
              </Text>
            ))}
          </View>
        </View>
        {item.draft && (
          <Text style={s.meta}>{t('계정에 저장한 작성 중인 계획')}</Text>
        )}
        {snapshot && (
          <View style={s.tags}>
            {snapshot.itinerary.some((entry) => entry.flight) && (
              <Text style={s.meta}>{t('항공편 등록')}</Text>
            )}
            {snapshot.itinerary.some((entry) => entry.type === 'STAY') && (
              <Text style={s.meta}>{t('숙소 일정 등록')}</Text>
            )}
          </View>
        )}
        {isError && (
          <DesignButton
            label={t('여행 정보 다시 불러오기')}
            variant="quiet"
            onPress={onRefetch}
          />
        )}
        <View style={s.actions}>
          <View style={s.action}>
            <DesignButton
              label={item.draft ? t('이어서 계획') : t('일정 보기')}
              icon={(color) => (
                <Ionicons
                  name={item.draft ? 'create-outline' : 'calendar-outline'}
                  size={18}
                  color={color}
                  accessible={false}
                />
              )}
              variant="primary"
              onPress={onOpen}
            />
          </View>
          {snapshot?.myRole === 'owner' && (
            <View style={s.action}>
              <DesignButton
                label={t('친구 초대')}
                icon={(color) => (
                  <Ionicons
                    name="person-add-outline"
                    size={18}
                    color={color}
                    accessible={false}
                  />
                )}
                onPress={onInvite}
              />
            </View>
          )}
        </View>
      </View>
      {snapshot && snapshot.itinerary.length > 0 && (
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

function HomeHeroHighlights({
  snapshot,
  onOpen,
}: {
  snapshot: WorkspaceSnapshot;
  onOpen: () => void;
}) {
  const dayNumberById = new Map(
    snapshot.days.map((day) => [day.id, day.dayNumber]),
  );
  const highlights = [...snapshot.itinerary]
    .sort(
      (a, b) =>
        (dayNumberById.get(a.dayId) || 1) - (dayNumberById.get(b.dayId) || 1) ||
        a.sortOrder - b.sortOrder,
    )
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

function HomeDestinationWidget({
  city,
  title,
  onOpenGuide,
}: {
  city: string;
  title: string;
  onOpenGuide: (key: string) => void;
}) {
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
          onPress={() => onOpenGuide(dest.key)}
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
      {guide.seasons[0]?.description ? (
        <View style={s.widgetTipBar}>
          <Text style={{ fontSize: 13 }} accessible={false}>
            💡
          </Text>
          <Text style={s.widgetTipText}>{guide.seasons[0].description}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
  const dayElapsed = Math.max(1, Math.abs(dDay) + 1);
  const receipts = snapshot?.receipts || [];
  return (
    <View
      testID={`home-travel-${item.id}`}
      style={[s.card, { padding: 16, gap: 14 }]}
    >
      <View style={s.inTripBanner}>
        <View style={s.inTripTopRow}>
          <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
            <Text style={s.inTripEyebrow}>NOW TRAVELING</Text>
            <Text style={s.inTripTitle}>
              {title} ({t('{p0}일차', { p0: dayElapsed })})
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>
              {date}
            </Text>
          </View>
          <View style={s.inTripCountPill}>
            <Text style={s.inTripCountText}>
              {snapshot
                ? t('총 {p0}개 일정', { p0: snapshot.itinerary.length })
                : t('여행 중')}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.inTripReceiptCta}>
        <View style={s.inTripReceiptIcon} accessible={false}>
          <Text style={{ fontSize: 20 }} accessible={false}>
            📸
          </Text>
        </View>
        <Text style={s.inTripReceiptTitle}>
          {t('방금 결제한 영수증이 있나요?')}
        </Text>
        <Text style={s.inTripReceiptDesc}>
          {t('찍어두면 방문 장소와 지출 내역을 한곳에 정리할 수 있어요.')}
        </Text>
        <DesignButton
          label={t('영수증 촬영 및 업로드')}
          variant="primary"
          onPress={onOpenExpenses}
        />
      </View>

      {receipts.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={s.subHeaderRow}>
            <Text style={s.subHeaderTitle}>
              {t('저장한 영수증')} ({receipts.length})
            </Text>
          </View>
          {receipts.slice(0, 3).map((receipt) => (
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
          ))}
        </View>
      )}

      <DesignButton label={t('일정 보기')} variant="quiet" onPress={onOpen} />
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
  const query = usePrivatePhotoQuery(userId, tripId, mediaId);
  const [failed, setFailed] = useState('');
  return query.data && !query.isError && failed !== query.data ? (
    <Image
      accessible={false}
      source={{ uri: query.data }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => setFailed(query.data || '')}
    />
  ) : null;
}
