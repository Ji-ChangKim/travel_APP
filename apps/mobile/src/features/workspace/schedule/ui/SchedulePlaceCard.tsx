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

// 방문 순서 번호 레일과 시간 배지·항공편명·장소명·주소·메모·비용/사진 기록·길찾기 카드를 렌더링한다.
export default function SchedulePlaceCard({
  item,
  index,
  last,
  selected,
  editable,
  disabled,
  expenses = [],
  photos = [],
  onOpen,
  onMore,
  onDirections,
  onExpense,
  onPhoto,
}: {
  item: WorkspaceSchedule;
  index: number;
  last: boolean;
  selected: boolean;
  editable: boolean;
  disabled: boolean;
  expenses?: WorkspaceExpense[];
  photos?: WorkspaceMedia[];
  onOpen: () => void;
  onMore: () => void;
  onDirections: () => void;
  onExpense?: () => void;
  onPhoto?: () => void;
}) {
  useLocale();
  const { largeText } = useAppAccessibility();
  const [focused, setFocused] = useState(false);
  const flightInfo = item.flight?.number
    ? [
        item.flight.number,
        item.flight.departure && item.flight.arrival
          ? `${item.flight.departure} → ${item.flight.arrival}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View style={s.stop} testID={`schedule-card-${item.id}`}>
      <View style={s.rail} aria-hidden>
        <View style={s.marker}>
          <Text style={s.number}>{index + 1}</Text>
        </View>
        {!last && <View style={s.line} />}
      </View>
      <View style={[s.card, selected && s.selected]}>
        <View style={s.row}>
          <View style={s.badgeGroup}>
            <View style={s.timePill}>
              <TripIcon name="clock-outline" size={14} color={colors.primary} />
              <Text style={s.timeText}>{item.timeSlot || t('시간 미정')}</Text>
            </View>
            {flightInfo ? (
              <View style={s.flightPill} testID={`schedule-flight-${item.id}`}>
                <TripIcon
                  name="flight-outline"
                  size={14}
                  color={colors.secondary}
                />
                <Text style={s.flightPillText}>{flightInfo}</Text>
              </View>
            ) : null}
          </View>
          {editable && (
            <DesignButton
              size="icon"
              variant="quiet"
              label=""
              accessibilityLabel={t('{p0} 일정 관리', { p0: item.title })}
              disabled={disabled}
              onPress={onMore}
              icon={(color) => {
                // 카드 우측 상단의 더보기 아이콘을 렌더링한다.
                return (
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color={color}
                  />
                );
              }}
            />
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('{p0} 일정 상세', { p0: item.title })}
          onPress={onOpen}
          onFocus={() => {
            // 카드 본문에 키보드 초점이 들어오면 외곽선을 표시한다.
            return setFocused(true);
          }}
          onBlur={() => {
            // 키보드 초점이 이동하면 카드 본문 외곽선을 해제한다.
            return setFocused(false);
          }}
          style={({ pressed }) => {
            // 눌림과 키보드 초점 상태를 카드 본문에 반영한다.
            return [s.cardMain, pressed && s.pressed, focused && s.focus];
          }}
        >
          <Text style={s.title} numberOfLines={largeText ? undefined : 2}>
            {item.title}
          </Text>
          {item.address ? (
            <View style={s.addressRow}>
              <TripIcon
                name="map-pin-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={s.meta} numberOfLines={largeText ? undefined : 1}>
                {item.address}
              </Text>
            </View>
          ) : null}
          {item.memo ? (
            <View style={s.memoBox}>
              <Text style={s.body} numberOfLines={largeText ? undefined : 2}>
                {item.memo}
              </Text>
            </View>
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
        </Pressable>
        <View style={s.cardFooter}>
          <DesignButton
            label={t('길찾기')}
            accessibilityLabel={t('{p0} 길찾기', { p0: item.title })}
            variant="quiet"
            onPress={onDirections}
            icon={(color) => {
              // 외부 지도 길찾기 아이콘을 버튼 상태 색상에 맞춰 표시한다.
              return (
                <Ionicons
                  name="navigate-outline"
                  size={18}
                  color={color || colors.text}
                />
              );
            }}
          />
          {editable && onExpense ? (
            <DesignButton
              label={t('비용 기록')}
              accessibilityLabel={t('{p0} 비용 기록', { p0: item.title })}
              variant="quiet"
              disabled={disabled}
              onPress={onExpense}
              icon={(color) => {
                // 방문 장소의 식사·구매 비용 기록 아이콘을 표시한다.
                return (
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    color={color || colors.text}
                  />
                );
              }}
            />
          ) : null}
          {editable && onPhoto ? (
            <DesignButton
              label={t('사진 공유')}
              accessibilityLabel={t('{p0} 사진 추가', { p0: item.title })}
              variant="quiet"
              disabled={disabled}
              onPress={onPhoto}
              icon={(color) => {
                // 방문 장소에서 찍은 사진 공유 아이콘을 표시한다.
                return (
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={color || colors.text}
                  />
                );
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
