import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { t } from '@/features/localization/translate';
import { getLocale, useLocale } from '@/features/localization/localeState';
import DesignButton from '@/components/ui/DesignButton';
import Text from '@/components/ui/AppText';
import type {
  WorkspaceSchedule,
  WorkspaceSnapshot,
  TravelLeg,
} from '@wherego/domain';
import type { EmptyScheduleCategory } from '../model/schedulePresentation';
import type { CityGuidePlace } from '../../community/model/cityGuides';
import type { RecommendedPlace } from '../ui/DayRecommendations';
import { tripTimelineStyles as s } from '../styles/tripTimelineStyles';
export { default } from './DaySchedule';

type Day = WorkspaceSnapshot['days'][number];
export interface Props {
  snapshot: WorkspaceSnapshot;
  userId: string;
  day: Day;
  disabled: boolean;
  canCreate: boolean;
  onAdd: () => void;
  onCourse: () => void;
  onPlan?: () => void;
  onSelectCategory?: (category: EmptyScheduleCategory) => void;
  onSelectSpot?: (spot: CityGuidePlace) => void;
  onOpenMap?: () => void;
  onCapture: (item: WorkspaceSchedule) => void;
  onPhoto: (item: WorkspaceSchedule) => void;
  onEdit: (item: WorkspaceSchedule) => void;
  onCopy: (item: WorkspaceSchedule) => void;
  onDelete: (item: WorkspaceSchedule) => void;
  onExpense: (item: WorkspaceSchedule) => void;
  onReorder: (ids: string[]) => void;
  onRecommend: (item: RecommendedPlace) => void;
  onRoute: (leg: TravelLeg) => void;
  busy?: boolean;
  pending?: boolean;
  error?: string;
  onRetry?: () => void;
  onReload?: () => void;
  onMove?: (item: WorkspaceSchedule, dayId: string, done: () => void) => void;
  selectedScheduleId?: string;
  onSelectSchedule?: (id: string) => void;
}

// 날짜 문자열(YYYY-MM-DD)을 DAY 카드 상단의 월.일 요일(예: 11.15 일) 형식으로 변환한다.
function formatDayCardDate(date: string, locale: string): string {
  // 기기 시간대 영향을 받지 않도록 UTC 정오 시각으로 요일을 계산한다.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  return `${month}.${day} ${weekday}`;
}

// 가로 스크롤 바에 날짜·DAY 번호·장소 수를 3줄 세로형 카드로 배치한다.
export function TripDayStrip({
  days,
  selected,
  onSelect,
  allowAll = false,
  counts,
}: {
  days: Day[];
  selected: string;
  onSelect: (id: string) => void;
  allowAll?: boolean;
  counts?: Record<string, number>;
}) {
  useLocale();
  const locale = getLocale();
  const [focusedId, setFocusedId] = useState('');
  // 긴 여행도 한 줄에서 날짜와 장소 수를 함께 탐색한다.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.days}
      accessibilityLabel={t('여행 날짜 선택')}
    >
      {allowAll && (
        <DesignButton
          label={t('전체')}
          size="chip"
          accessibilityLabel={t('전체 일정')}
          selected={selected === 'all'}
          selectionStyle="fill"
          onPress={() => {
            /* 전체 날짜를 조회한다. */ return onSelect('all');
          }}
        />
      )}
      {days.map((day) => {
        const isSelected = selected === day.id;
        const countLabel = counts
          ? t('장소 {p0}개', { p0: counts[day.id] ?? 0 })
          : '';
        // 선택한 날짜를 채움형 3줄 카드로 강조해 표시한다.
        return (
          <Pressable
            key={day.id}
            testID={`trip-day-card-${day.dayNumber}`}
            accessibilityRole="button"
            accessibilityLabel={`DAY ${day.dayNumber} · ${day.tripDate}${countLabel ? ` · ${countLabel}` : ''}`}
            accessibilityState={{ selected: isSelected }}
            aria-selected={isSelected}
            onFocus={() => {
              // 키보드 초점이 이동한 DAY 카드에 외곽선을 표시한다.
              return setFocusedId(day.id);
            }}
            onBlur={() => {
              // 초점이 벗어나면 DAY 카드 외곽선을 해제한다.
              return setFocusedId((current) =>
                current === day.id ? '' : current,
              );
            }}
            onPress={() => {
              /* 실제 DAY만 선택한다. */ return onSelect(day.id);
            }}
            style={({ pressed }) => {
              // 선택·눌림·초점 상태를 DAY 카드 배경과 테두리에 반영한다.
              return [
                s.dayCard,
                isSelected && s.dayCardSelected,
                !isSelected && pressed && s.dayCardPressed,
                focusedId === day.id && s.dayCardFocused,
              ];
            }}
          >
            <Text
              style={[s.dayCardDateText, isSelected && s.dayCardTextSelected]}
            >
              {formatDayCardDate(day.tripDate, locale)}
            </Text>
            <Text
              style={[s.dayCardTitleText, isSelected && s.dayCardTextSelected]}
            >
              {`DAY ${day.dayNumber}`}
            </Text>
            {countLabel ? (
              <Text
                style={[
                  s.dayCardCountText,
                  isSelected && s.dayCardTextSelected,
                ]}
              >
                {countLabel}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
