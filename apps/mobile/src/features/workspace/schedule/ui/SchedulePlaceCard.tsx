import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  WorkspaceExpense,
  WorkspaceMedia,
  WorkspaceSchedule,
} from '@wherego/domain';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { schedulePageStyles as s } from '../styles/schedulePageStyles';

// 항공편 일정의 항공사·편명·출발·도착 요약 문자열을 생성한다.
function formatFlightSummary(
  item: WorkspaceSchedule,
  tripDate?: string,
): string {
  if (!item.flight) return '';
  const number = item.flight.number || '';
  const airlineCandidate = number
    ? item.title.replace(number, '').replace(/→.*/, '').trim()
    : '';
  const airlinePart = airlineCandidate ? `항공사: ${airlineCandidate}` : '';
  const numberPart = number ? `항공편: ${number}` : '';
  const depTime = item.timeSlot || '';
  const depDateStr = [tripDate, depTime].filter(Boolean).join(' ');
  const depPart = item.flight.departure
    ? `출발: ${item.flight.departure}${depDateStr ? ` · ${depDateStr}` : ''}`
    : '';
  const arrDate =
    item.flight.arrivalDate || (item.flight.arrivalTime ? tripDate : '') || '';
  const arrDateStr = [arrDate, item.flight.arrivalTime]
    .filter(Boolean)
    .join(' ');
  const arrPart = item.flight.arrival
    ? `도착: ${item.flight.arrival}${arrDateStr ? ` · ${arrDateStr}` : ''}`
    : '';
  return [airlinePart, numberPart, depPart, arrPart].filter(Boolean).join(' ');
}

// 일정의 제목과 유형을 분석해 카드 상단 1차 일정 태그 문구를 반환한다.
function resolveCategoryTagLabel(item: WorkspaceSchedule): string {
  if (
    item.type === 'STAY' ||
    /호텔|숙소|리조트|료칸|호스텔/i.test(item.title)
  ) {
    return t('숙소');
  }
  if (
    item.type === 'TRANSPORT' ||
    Boolean(item.flight) ||
    /항공|공항|역|정류장|터미널|신칸센/i.test(item.title)
  ) {
    return t('교통·이동');
  }
  if (/카페|커피|베이커리|디저트|블루보틀/i.test(item.title)) {
    return t('카페');
  }
  if (
    /식당|라멘|맛집|이자카야|우동|스시|쌀국수|식사|곤파치/i.test(item.title)
  ) {
    return t('식사');
  }
  if (/쇼핑|백화점|스퀘어|전망|타워|스카이/i.test(item.title)) {
    return t('쇼핑 & 전망');
  }
  if (item.type === 'MEMO' || item.type === 'TODO') {
    return t('메모');
  }
  return t('관광명소');
}

// 방문 시간 없이 순번 원형 배지(좌)와 일정 카드(1.타이틀 / 2.태그 / 3.순서변경 아이콘 / 4.전체 클릭 시 상세 이동)를 렌더링한다.
export default function SchedulePlaceCard({
  item,
  index,
  stepNumber,
  tripDate,
  editingOrder = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onQuickDelete,
  selected,
  editable,
  disabled,
  expenses = [],
  photos = [],
  onOpen,
  onMore,
  onDirections,
}: {
  item: WorkspaceSchedule;
  index: number;
  stepNumber?: number | null;
  tripDate?: string;
  nextDistanceLabel?: string;
  editingOrder?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onQuickDelete?: () => void;
  last: boolean;
  selected: boolean;
  editable: boolean;
  disabled: boolean;
  expenses?: WorkspaceExpense[];
  photos?: WorkspaceMedia[];
  onOpen: () => void;
  onMore: () => void;
  onDirections?: () => void;
  onExpense?: () => void;
  onPhoto?: () => void;
}) {
  useLocale();
  const { largeText } = useAppAccessibility();
  const [focused, setFocused] = useState(false);

  const isFlight = Boolean(item.flight);
  const isMemo =
    item.type === 'MEMO' ||
    item.type === 'TODO' ||
    item.title.trim() === '메모';
  const flightSummary = formatFlightSummary(item, tripDate);
  const memoText =
    item.memo && !(isFlight && item.memo === '사용자 등록 항공편')
      ? item.memo
      : '';
  const planDesc = item.planContent?.description?.trim() || '';
  const canNavigate = Boolean(onDirections && !isFlight && !isMemo);
  const displayStep = stepNumber ?? index + 1;
  const categoryLabel = resolveCategoryTagLabel(item);
  const isReserved =
    item.type === 'RESERVATION' || /예약/i.test(`${memoText} ${planDesc}`);
  const isFeatured = photos.length > 0 || isReserved || displayStep % 2 === 0;
  const primaryExpense = expenses[0];
  const shortAddress = item.address
    ? item.address.split(',')[0]?.trim() || item.address
    : '';

  return (
    <View
      style={[s.stop, selected && s.selected]}
      testID={`schedule-card-${item.id}`}
    >
      <View style={s.rail} aria-hidden>
        {editingOrder && editable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('{p0} 삭제', { p0: item.title })}
            disabled={disabled}
            onPress={onQuickDelete}
            style={s.deleteInlineBtn}
          >
            <Ionicons name="remove-circle" size={24} color={colors.danger} />
          </Pressable>
        ) : (
          <View
            style={[
              s.marker,
              isMemo ? s.memoMarker : s.placeMarker,
              isFeatured && s.featuredMarker,
            ]}
          >
            <Text style={[s.number, isFeatured && s.featuredNumber]}>
              {displayStep}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('{p0} 일정 상세', { p0: item.title })}
        onPress={onOpen}
        onLongPress={editable && !disabled ? onMore : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          s.card,
          pressed && s.pressed,
          focused && s.focus,
        ]}
      >
        <View style={s.timelineHeaderRow}>
          <View style={s.tagRow}>
            <View style={s.categoryTagPill}>
              <Text style={s.categoryTagText}>{categoryLabel}</Text>
            </View>
            {isReserved && (
              <View style={s.reserveTagPill}>
                <Text style={s.reserveTagText}>{t('예약완료')}</Text>
              </View>
            )}
            {primaryExpense ? (
              <View
                style={s.subTagPill}
                testID={`schedule-expense-badge-${primaryExpense.id}`}
              >
                <Text style={s.subTagText}>
                  {t('예산 {p0} {p1}', {
                    p0: primaryExpense.currency,
                    p1: primaryExpense.amount,
                  })}
                </Text>
              </View>
            ) : shortAddress ? (
              <Text style={s.inlineMetaText} numberOfLines={1}>
                {shortAddress}
              </Text>
            ) : null}
          </View>

          <View style={s.timelineRightActions}>
            {editingOrder && editable ? (
              <>
                <DesignButton
                  size="icon"
                  variant="quiet"
                  label=""
                  accessibilityLabel={t('{p0} 위로 이동', { p0: item.title })}
                  disabled={disabled || !canMoveUp}
                  onPress={() => onMoveUp?.()}
                  icon={(color) => (
                    <Ionicons name="arrow-up" size={18} color={color} />
                  )}
                />
                <DesignButton
                  size="icon"
                  variant="quiet"
                  label=""
                  accessibilityLabel={t('{p0} 아래로 이동', { p0: item.title })}
                  disabled={disabled || !canMoveDown}
                  onPress={() => onMoveDown?.()}
                  icon={(color) => (
                    <Ionicons name="arrow-down" size={18} color={color} />
                  )}
                />
              </>
            ) : (
              editable && (
                <DesignButton
                  size="icon"
                  variant="quiet"
                  label=""
                  accessibilityLabel={t('{p0} 일정 관리', { p0: item.title })}
                  disabled={disabled}
                  onPress={onMore}
                  icon={(color) => (
                    <Ionicons
                      name="ellipsis-vertical"
                      size={16}
                      color={color}
                    />
                  )}
                />
              )
            )}
          </View>
        </View>

        <Text
          style={s.timelineItemTitle}
          numberOfLines={largeText ? undefined : 2}
        >
          {item.title}
        </Text>

        {flightSummary ? (
          <View testID={`schedule-flight-${item.id}`}>
            <Text
              style={s.timelineDetailText}
              numberOfLines={largeText ? undefined : 2}
            >
              {flightSummary}
            </Text>
          </View>
        ) : null}

        {memoText ? (
          <Text
            style={s.timelineDetailText}
            numberOfLines={largeText ? undefined : 2}
          >
            {memoText}
          </Text>
        ) : null}

        {photos.length > 0 && (
          <View
            style={s.photoPreviewBox}
            testID={`schedule-photo-badge-${item.id}`}
          >
            <View style={s.tagRow}>
              <Ionicons
                name="image-outline"
                size={18}
                color={colors.brandCoral}
              />
              <Text style={s.recordBadgeText}>
                {t('사진 {p0}장', { p0: photos.length })}
              </Text>
            </View>
            <Text style={s.inlineMetaText}>{t('상세 보기 ›')}</Text>
          </View>
        )}

        {canNavigate && (
          <View style={s.timelineInlineActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('{p0} 길찾기', { p0: item.title })}
              onPress={onDirections}
              style={({ pressed }) => [
                s.timelineDirectionsBtn,
                pressed && s.pressed,
              ]}
            >
              <TripIcon
                name="map-pin-outline"
                size={14}
                color={colors.secondary}
              />
              <Text style={s.timelineDirectionsText}>{t('길찾기')}</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </View>
  );
}
