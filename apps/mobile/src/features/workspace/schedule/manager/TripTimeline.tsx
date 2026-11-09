import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
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
  onAddFlight?: () => void;
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

// 가로 스크롤 바에 DAY 번호(DAY 1 ~ DAY M) 카드를 배치한다.
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
  const [focusedId, setFocusedId] = useState('');
  // 긴 여행도 한 줄에서 일차(DAY N)를 직관적으로 탐색한다.
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
        // 선택한 일차를 코랄 채움형 카드로 강조해 표시한다.
        return (
          <Pressable
            key={day.id}
            testID={`trip-day-card-${day.dayNumber}`}
            accessibilityRole="button"
            accessibilityLabel={`DAY ${day.dayNumber}${countLabel ? ` · ${countLabel}` : ''}`}
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
              style={[s.dayCardTitleText, isSelected && s.dayCardTextSelected]}
            >
              {`DAY ${day.dayNumber}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
