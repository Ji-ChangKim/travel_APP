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

// 시간 열·타임라인 축(점선 또는 번호 원)·일정 제목·접기/펼치기 상세를 렌더링한다.
export default function SchedulePlaceCard({
  item,
  index,
  stepNumber,
  tripDate,
  nextDistanceLabel,
  editingOrder = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onQuickDelete,
  last,
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
  const [expanded, setExpanded] = useState(true);

  const isFlight = Boolean(item.flight);
  const isMemo =
    item.type === 'MEMO' ||
    item.type === 'TODO' ||
    item.title.trim() === '메모';
  const timeLabel = item.timeSlot || '';
  const flightSummary = formatFlightSummary(item, tripDate);
  const memoText =
    item.memo && !(isFlight && item.memo === '사용자 등록 항공편')
      ? item.memo
      : '';
  const planDesc = item.planContent?.description?.trim() || '';
  const canNavigate = Boolean(onDirections && !isFlight && !isMemo);
  const hasDetails = Boolean(
    flightSummary ||
    memoText ||
    item.address ||
    planDesc ||
    canNavigate ||
    expenses.length > 0 ||
    photos.length > 0,
  );
  const displayStep = stepNumber ?? index + 1;

  return (
    <View
      style={[s.stop, selected && s.selected]}
      testID={`schedule-card-${item.id}`}
    >
      <View style={s.timeColumn}>
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
        ) : timeLabel ? (
          <Text style={s.timeColumnText}>{timeLabel}</Text>
        ) : null}
      </View>

      <View style={s.rail} aria-hidden>
        {isFlight ? (
          <>
            <View style={s.dottedRail}>
              {[0, 1, 2, 3, 4, 5, 6].map((dot) => (
                <View key={dot} style={s.railDot} />
              ))}
            </View>
            {!last && <View style={s.line} />}
          </>
        ) : (
          <>
            <View style={[s.topLine, index === 0 && s.hiddenLine]} />
            <View style={[s.marker, isMemo ? s.memoMarker : s.placeMarker]}>
              <Text style={s.number}>{displayStep}</Text>
            </View>
            {!last && (
              <>
                <View style={s.line} />
                {nextDistanceLabel ? (
                  <View style={s.distancePill}>
                    <Text style={s.distanceText}>{nextDistanceLabel}</Text>
                  </View>
                ) : null}
                {nextDistanceLabel ? <View style={s.line} /> : null}
              </>
            )}
          </>
        )}
      </View>

      <View style={s.card}>
        <View style={s.timelineHeaderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('{p0} 일정 상세', { p0: item.title })}
            onPress={onOpen}
            onLongPress={editable && !disabled ? onMore : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [
              s.timelineTitleButton,
              pressed && s.pressed,
              focused && s.focus,
            ]}
          >
            <Text
              style={s.timelineItemTitle}
              numberOfLines={largeText ? undefined : 2}
            >
              {item.title}
            </Text>
          </Pressable>

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
              <>
                {hasDetails && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => setExpanded((prev) => !prev)}
                    style={s.chevronButton}
                  >
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                )}
                {editable && (
                  <DesignButton
                    size="icon"
                    variant="quiet"
                    label=""
                    accessibilityLabel={t('{p0} 일정 관리', { p0: item.title })}
                    disabled={disabled}
                    onPress={onMore}
                    icon={(color) => (
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color={color}
                      />
                    )}
                  />
                )}
              </>
            )}
          </View>
        </View>

        {expanded && hasDetails && (
          <Pressable onPress={onOpen} style={s.timelineDetailBlock}>
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
            {item.address ? (
              <Text
                style={s.timelineDetailText}
                numberOfLines={largeText ? undefined : 1}
              >
                {item.address}
              </Text>
            ) : null}
            {planDesc && planDesc !== memoText ? (
              <Text
                style={s.timelineDetailText}
                numberOfLines={largeText ? undefined : 2}
              >
                {planDesc}
              </Text>
            ) : null}
            {(expenses.length > 0 || photos.length > 0) && (
              <View style={s.recordBadgeRow}>
                {expenses.map((expense) => (
                  <View
                    key={expense.id}
                    style={s.recordBadge}
                    testID={`schedule-expense-badge-${expense.id}`}
                  >
                    <TripIcon
                      name="receipt-scan-outline"
                      size={14}
                      color={colors.secondary}
                    />
                    <Text style={s.recordBadgeText}>
                      {`${expense.currency} ${expense.amount}${
                        expense.title && expense.title !== item.title
                          ? ` · ${expense.title}`
                          : ''
                      }`}
                    </Text>
                  </View>
                ))}
                {photos.length > 0 && (
                  <View
                    style={s.recordBadge}
                    testID={`schedule-photo-badge-${item.id}`}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={s.recordBadgeText}>
                      {t('사진 {p0}장', { p0: photos.length })}
                    </Text>
                  </View>
                )}
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
        )}
      </View>
    </View>
  );
}
