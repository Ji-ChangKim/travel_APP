import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { colors } from '@/constants/theme';
import { guideForTrip, type CityGuidePlace } from './cityGuides';

export interface EmptyScheduleCategory {
  label: string;
  type: 'PLACE' | 'STAY';
  query: string;
}

const QUICK_CATEGORIES: {
  emoji: string;
  label: string;
  type: 'PLACE' | 'STAY';
  query: string;
}[] = [
  { emoji: '☕', label: '카페/디저트', type: 'PLACE', query: '카페 디저트' },
  { emoji: '🍜', label: '맛집', type: 'PLACE', query: '맛집 식당' },
  { emoji: '⛩️', label: '명소/관광', type: 'PLACE', query: '관광 명소' },
  { emoji: '🛍️', label: '쇼핑', type: 'PLACE', query: '쇼핑 상점가' },
  { emoji: '🏨', label: '숙소', type: 'STAY', query: '호텔 숙소' },
];

// 빈 날짜에서 실제로 시작할 수 있는 경로와 도시별 추천 명소를 안내한다.
export default function TripScheduleEmpty({
  canCreate,
  disabled,
  onCourse,
  onSearch,
  country = '',
  city = '',
  existingTitles = [],
  onSelectCategory,
  onSelectSpot,
  onOpenMap,
}: {
  canCreate: boolean;
  disabled: boolean;
  onCourse: () => void;
  onSearch: () => void;
  country?: string;
  city?: string;
  existingTitles?: string[];
  onSelectCategory?: (category: EmptyScheduleCategory) => void;
  onSelectSpot?: (spot: CityGuidePlace) => void;
  onOpenMap?: () => void;
}) {
  useLocale();
  const guide = guideForTrip(country, city);

  // 읽기 전용에서는 작성 행동을 숨기고 아직 일정이 없다는 결과만 알린다.
  if (!canCreate) {
    return (
      <View style={s.container}>
        <HaruState
          kind="empty"
          compact
          title={t('이날은 등록된 일정이 없어요')}
          description={t('동행이 일정을 추가하면 여기에서 확인할 수 있어요.')}
        />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.heroCard}>
        <View style={s.heroBadgeWrap} aria-hidden>
          <View style={s.heroOuterRing}>
            <View style={s.heroInnerCircle}>
              <Ionicons name="location-outline" size={28} color="#FFFFFF" />
            </View>
          </View>
          <View style={s.heroPlaneBadge}>
            <Ionicons name="airplane" size={14} color="#203247" />
          </View>
        </View>

        <View style={s.heroCopy}>
          <Text style={s.heroTitle}>{t('아직 등록된 일정이 없어요')}</Text>
          <Text style={s.heroDesc}>
            {t('가고 싶은 장소를 검색하거나 추천 명소를 일정에 쏙 담아보세요.')}
          </Text>
        </View>

        <View style={s.guideActions} testID="schedule-empty-guides">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('장소 검색으로 추가')}
            disabled={disabled}
            onPress={onSearch}
            style={[s.primaryPillBtn, disabled && s.disabledBtn]}
          >
            <Text style={[s.primaryPillText, disabled && s.disabledText]}>
              + {t('장소 추가하기')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('추천 코스 불러오기')}
            disabled={disabled}
            onPress={onCourse}
            style={[s.secondaryPillBtn, disabled && s.disabledBtn]}
          >
            <Text style={[s.secondaryPillText, disabled && s.disabledText]}>
              {t('추천 코스 불러오기')}
            </Text>
          </Pressable>
        </View>

        <View style={s.categorySection}>
          <Text style={s.categoryTitle}>{t('어떤 장소를 찾고 계신가요?')}</Text>
          <View style={s.chipRow}>
            {QUICK_CATEGORIES.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={t('{p0} 장소 찾기', {
                  p0: t(item.label),
                })}
                disabled={disabled}
                onPress={() => {
                  return onSelectCategory
                    ? onSelectCategory({
                        label: item.label,
                        type: item.type,
                        query: item.query,
                      })
                    : onSearch();
                }}
                style={s.categoryChip}
              >
                <Text style={s.chipEmoji} aria-hidden>
                  {item.emoji}
                </Text>
                <Text style={s.chipText}>{t(item.label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {guide && (
        <View style={s.curatedSection}>
          <View style={s.curatedHeader}>
            <View style={s.curatedTitleRow}>
              <View style={s.thumbBadge} aria-hidden>
                <Ionicons name="thumbs-up" size={13} color="#FFFFFF" />
              </View>
              <Text style={s.curatedHeading}>
                {city.trim()} {t('필수 명소 바로 담기')}
              </Text>
            </View>
            {onOpenMap && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('추천 명소 지도에서 보기')}
                disabled={disabled}
                onPress={onOpenMap}
                style={s.mapLinkBtn}
              >
                <Text style={s.mapLinkText}>{t('지도에서 보기')} ›</Text>
              </Pressable>
            )}
          </View>

          <View style={s.spotList}>
            {guide.places.map((place) => {
              const added = existingTitles.includes(place.title);
              return (
                <View key={place.title} style={s.spotCard}>
                  <Image
                    source={guide.photo}
                    style={s.spotThumb}
                    accessibilityIgnoresInvertColors
                  />
                  <View style={s.spotInfo}>
                    <Text style={s.spotTag}>
                      {place.areaTag ? t(place.areaTag) : t('추천 명소')}
                    </Text>
                    <Text style={s.spotTitle}>{place.title}</Text>
                    <Text style={s.spotDesc} numberOfLines={2}>
                      {place.description}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('{p0} 바로 담기', {
                      p0: place.title,
                    })}
                    disabled={disabled}
                    onPress={() => {
                      return onSelectSpot ? onSelectSpot(place) : onCourse();
                    }}
                    style={[s.addSpotBtn, added && s.addedSpotBtn]}
                  >
                    <Text style={[s.addSpotText, added && s.addedSpotText]}>
                      {added ? t('담김') : '+ ' + t('담기')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={s.tipCard}>
        <View style={s.tipIconCircle} aria-hidden>
          <Ionicons name="bulb-outline" size={20} color="#A43E31" />
        </View>
        <View style={s.tipContent}>
          <Text style={s.tipTitle}>{t('여행 팁')}</Text>
          <Text style={s.tipBody} numberOfLines={2}>
            {guide?.seasons[0]?.description ||
              guide?.intro ||
              t(
                '가고 싶은 장소를 먼저 담아두면 날짜별 동선과 이동수단을 한눈에 비교할 수 있어요.',
              )}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', gap: 20 },
  heroCard: {
    width: '100%',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  heroBadgeWrap: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaneBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroCopy: {
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  guideActions: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  primaryPillBtn: {
    width: '100%',
    maxWidth: 280,
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 9999,
    backgroundColor: '#A43E31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPillText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryPillBtn: {
    width: '100%',
    maxWidth: 280,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 9999,
    backgroundColor: '#FFF0EB',
    borderWidth: 1,
    borderColor: '#A43E31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: '#A43E31',
  },
  disabledBtn: {
    backgroundColor: '#EEE8E2',
    borderColor: '#EEE8E2',
  },
  disabledText: {
    color: '#596574',
  },
  categorySection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryTitle: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  categoryChip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#F1F4FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipEmoji: {
    fontSize: 15,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  curatedSection: {
    width: '100%',
    gap: 12,
  },
  curatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  curatedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  thumbBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A43E31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  curatedHeading: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  mapLinkBtn: {
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLinkText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: '#A43E31',
  },
  spotList: {
    gap: 10,
  },
  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  spotThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
  },
  spotInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  spotTag: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#A43E31',
  },
  spotTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
  },
  spotDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  addSpotBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: '#FFF0EB',
    borderWidth: 1,
    borderColor: '#A43E31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedSpotBtn: {
    backgroundColor: '#F1F4FA',
    borderColor: '#E2E8F0',
  },
  addSpotText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#A43E31',
  },
  addedSpotText: {
    color: '#596574',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EAF5F8',
    borderWidth: 1,
    borderColor: '#D5E8F0',
  },
  tipIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
  tipBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
