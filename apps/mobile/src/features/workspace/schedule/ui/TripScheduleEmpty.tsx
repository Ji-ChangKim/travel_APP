import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { triggerHaptic } from '@/components/haptics';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { guideForTrip, type CityGuidePlace } from '../../cityGuides';
import {
  emptyScheduleCategories,
  type EmptyScheduleCategory,
} from '../model/schedulePresentation';
import { scheduleTheme as theme } from '../styles/scheduleTheme';
import { tripScheduleEmptyStyles as s } from '../styles/tripScheduleEmptyStyles';

export type { EmptyScheduleCategory } from '../model/schedulePresentation';

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
  const { largeText } = useAppAccessibility();
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
              <Ionicons
                name="location-outline"
                size={28}
                color={colors.textLight}
              />
            </View>
          </View>
          <View style={s.heroPlaneBadge}>
            <Ionicons name="airplane" size={14} color={colors.text} />
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
            onPress={() => {
              // 장소 검색을 펼쳐 선택한 날짜의 새 일정 초안을 연다.
              triggerHaptic('light');
              return onSearch();
            }}
            style={({ pressed }) => {
              // 주요 행동 버튼의 눌림과 비활성 상태를 함께 표시한다.
              return [
                s.primaryPillBtn,
                pressed && s.pressedBtn,
                disabled && s.disabledBtn,
              ];
            }}
          >
            <Text style={[s.primaryPillText, disabled && s.disabledText]}>
              + {t('장소 추가하기')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('추천 코스 불러오기')}
            disabled={disabled}
            onPress={() => {
              // 도시별 추천 코스 선택 시트를 열어 초안에 반영하게 한다.
              triggerHaptic('light');
              return onCourse();
            }}
            style={({ pressed }) => {
              // 보조 필 버튼의 눌림과 비활성 상태를 함께 표시한다.
              return [
                s.secondaryPillBtn,
                pressed && s.pressedSecondaryBtn,
                disabled && s.disabledBtn,
              ];
            }}
          >
            <Text style={[s.secondaryPillText, disabled && s.disabledText]}>
              {t('추천 코스 불러오기')}
            </Text>
          </Pressable>
        </View>

        <View style={s.categorySection}>
          <Text style={s.categoryTitle}>{t('어떤 장소를 찾고 계신가요?')}</Text>
          <View style={s.chipRow}>
            {emptyScheduleCategories.map((item) => {
              // 선택한 카테고리 유형으로 일정 작성 화면을 바로 연다.
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={t('{p0} 장소 찾기', {
                    p0: t(item.label),
                  })}
                  disabled={disabled}
                  onPress={() => {
                    // 카테고리 유형과 검색 펼침 상태를 작성 초안에 전달한다.
                    triggerHaptic('light');
                    return onSelectCategory
                      ? onSelectCategory(item)
                      : onSearch();
                  }}
                  style={({ pressed }) => {
                    // 빠른 카테고리 칩의 눌림 반응을 표시한다.
                    return [s.categoryChip, pressed && s.pressedSecondaryBtn];
                  }}
                >
                  <Text style={s.chipEmoji} aria-hidden>
                    {item.emoji}
                  </Text>
                  <Text style={s.chipText}>{t(item.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {guide && (
        <CuratedSpotsSection
          city={city}
          guide={guide}
          disabled={disabled}
          largeText={largeText}
          existingTitles={existingTitles}
          onOpenMap={onOpenMap}
          onSelectSpot={onSelectSpot}
          onCourse={onCourse}
        />
      )}

      <View style={s.tipCard}>
        <View style={s.tipIconCircle} aria-hidden>
          <Ionicons
            name="bulb-outline"
            size={20}
            color={theme.color.brand.coralPressed}
          />
        </View>
        <View style={s.tipContent}>
          <Text style={s.tipTitle}>{t('여행 팁')}</Text>
          <Text style={s.tipBody} numberOfLines={largeText ? 4 : 2}>
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

// 도시 가이드가 있는 여행지에서 필수 명소 카드와 바로 담기 행동을 표시한다.
function CuratedSpotsSection({
  city,
  guide,
  disabled,
  largeText,
  existingTitles,
  onOpenMap,
  onSelectSpot,
  onCourse,
}: {
  city: string;
  guide: NonNullable<ReturnType<typeof guideForTrip>>;
  disabled: boolean;
  largeText: boolean;
  existingTitles: string[];
  onOpenMap?: () => void;
  onSelectSpot?: (spot: CityGuidePlace) => void;
  onCourse: () => void;
}) {
  useLocale();
  // 이미 일정에 담긴 명소는 담김 상태로 구분해 중복 여부를 알린다.
  return (
    <View style={s.curatedSection}>
      <View style={s.curatedHeader}>
        <View style={s.curatedTitleRow}>
          <View style={s.thumbBadge} aria-hidden>
            <Ionicons name="thumbs-up" size={13} color={colors.textLight} />
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
            onPress={() => {
              // 지도 섹션으로 전환해 여행 동선을 확인하게 한다.
              triggerHaptic('light');
              return onOpenMap();
            }}
            style={s.mapLinkBtn}
          >
            <Text style={s.mapLinkText}>{t('지도에서 보기')} ›</Text>
          </Pressable>
        )}
      </View>

      <View style={s.spotList}>
        {guide.places.map((place) => {
          // 현재 여행 일정에 같은 제목의 명소가 등록되어 있는지 확인한다.
          const added = existingTitles.includes(place.title);
          return (
            <View
              key={place.title}
              style={[s.spotCard, largeText && s.spotCardLarge]}
            >
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
                <Text style={s.spotDesc} numberOfLines={largeText ? 3 : 2}>
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
                  // 선택한 명소의 제목과 설명을 일정 작성 초안에 채운다.
                  triggerHaptic('light');
                  return onSelectSpot ? onSelectSpot(place) : onCourse();
                }}
                style={({ pressed }) => {
                  // 큰 글씨 모드와 담김 상태에 맞는 버튼 모양을 유지한다.
                  return [
                    s.addSpotBtn,
                    largeText && s.addSpotBtnLarge,
                    added && s.addedSpotBtn,
                    pressed && s.pressedSecondaryBtn,
                  ];
                }}
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
  );
}
