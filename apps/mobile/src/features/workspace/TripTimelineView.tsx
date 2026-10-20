import Text from '@/components/AppText';
import TripIcon from '@/components/icons/TripIcon';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSchedule } from '@wherego/domain';
import { Pressable, View } from 'react-native';
import FlightCard from './FlightCard';
import GooglePlace from './GooglePlace';
import PlanDescription from './PlanDescription';
import { ScheduleButton } from './ScheduleControls';
import ServerPhoto from './ServerPhoto';
import { scheduleFlight } from './flightModel';
import { scheduleDuration, scheduleKind } from './schedulePresentation';
import {
  scheduleStyles as shared,
  scheduleTheme as theme,
} from './scheduleTheme';
import { tripTimelineStyles } from './tripTimelineStyles';

import type { Props } from './TripTimeline';
// renderTimelinePlace이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderTimelinePlaceProps = {
  item: WorkspaceSchedule;
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  };
  index: number;
  items: WorkspaceSchedule[];
};

// 방문 장소·설명·사진과 관리 행동을 표시한다.
export function renderTimelinePlace({
  item,
  props,
  index,
  items,
}: RenderTimelinePlaceProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={s.placeCard}>
      <View style={s.cardTop}>
        <View style={s.badge}>
          <TripIcon
            name={
              scheduleFlight(item)
                ? 'flight-outline'
                : scheduleKind(item.type).icon
            }
            size={14}
          />
          <Text style={s.badgeText}>
            {scheduleFlight(item) ? '항공편' : scheduleKind(item.type).label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title + ' 일정 관리'}
          accessibilityState={{
            expanded: props.expanded[0] === item.id,
          }}
          onPress={() => {
            /* 선택 장소의 관리 동작을 펼친다. */ return props.expanded[1](
              props.expanded[0] === item.id ? '' : item.id,
            );
          }}
          style={s.handle}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={theme.color.text.secondary}
          />
        </Pressable>
      </View>
      {scheduleFlight(item) ? (
        <FlightCard
          flight={scheduleFlight(item)!}
          departureTime={item.timeSlot}
          date={props.day.tripDate}
        />
      ) : (
        <Text
          accessibilityLabel={
            (item.timeSlot || '시간 미정') + ' · ' + item.title
          }
          style={s.placeTitle}
        >
          {item.title}
        </Text>
      )}
      {item.address ? <Text style={shared.meta}>{item.address}</Text> : null}
      <PlanDescription
        title={item.title}
        content={item.planContent}
        address={item.address}
      />
      {item.memo &&
      !(scheduleFlight(item) && item.memo === '사용자 등록 항공편') ? (
        <Text style={shared.body}>{item.memo}</Text>
      ) : null}
      {props.snapshot.media
        .filter((media) => {
          /* 실제 여행 사진만 선택한다. */ return (
            media.scheduleId === item.id && media.purpose === 'photo'
          );
        })
        .map((media) => (
          <ServerPhoto
            key={media.id}
            userId={props.userId}
            tripId={props.snapshot.trip.id}
            mediaId={media.id}
          />
        ))}
      <View style={shared.row}>
        {item.durationMinutes ? (
          <View style={shared.row}>
            <TripIcon name="clock-outline" size={14} />
            <Text style={shared.meta}>
              체류 {scheduleDuration(item.durationMinutes)}
            </Text>
          </View>
        ) : null}
        {props.snapshot.expenses
          .filter((expense) => {
            /* 일정의 예상·실제 비용을 구분해 표시한다. */ return (
              expense.scheduleId === item.id
            );
          })
          .map((expense) => (
            <View key={expense.id} style={s.spend}>
              <Text style={shared.meta}>
                {expense.isActual ? '실제 지출' : '예상 비용'}
              </Text>
              <Text style={s.amount}>
                {expense.currency}{' '}
                {new Intl.NumberFormat('ko-KR', {
                  maximumFractionDigits: 2,
                }).format(Number(expense.amount))}
              </Text>
            </View>
          ))}
      </View>
      {item.googlePlaceId && (
        <GooglePlace
          userId={props.userId}
          placeId={item.googlePlaceId}
          label={item.title}
        />
      )}
      {renderTimelineActions({ props, item })}
      {renderTimelineManagement({ props, item })}
      {props.arranging[0] && (
        <View style={shared.row}>
          <ScheduleButton
            label={item.title + ' 위로 이동'}
            disabled={props.disabled || index === 0}
            onPress={() => {
              /* 앞 일정과 순서를 바꾼다. */ return props.onReorder(
                movedIds(items, index, -1),
              );
            }}
          />
          <ScheduleButton
            label={item.title + ' 아래로 이동'}
            disabled={props.disabled || index === items.length - 1}
            onPress={() => {
              /* 뒤 일정과 순서를 바꾼다. */ return props.onReorder(
                movedIds(items, index, 1),
              );
            }}
          />
        </View>
      )}
    </View>
  );
}
// renderTimelineManagement이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderTimelineManagementProps = {
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  };
  item: WorkspaceSchedule;
};

// 일정의 순서·수정·삭제 행동을 표시한다.
export function renderTimelineManagement({
  props,
  item,
}: RenderTimelineManagementProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    props.expanded[0] === item.id && (
      <View style={{ gap: 8 }}>
        <Text style={shared.meta}>일정 관리</Text>
        <ScheduleButton
          label="이 일정에서 사진 촬영"
          disabled={props.disabled}
          onPress={() => {
            /* 실제 카메라를 연다. */ return props.onCapture(item);
          }}
        />
        <ScheduleButton
          label="이 일정에 사진 추가"
          disabled={props.disabled}
          onPress={() => {
            /* 실제 앨범을 연다. */ return props.onPhoto(item);
          }}
        />
        <ScheduleButton
          label="일정 수정"
          disabled={props.disabled}
          onPress={() => {
            /* 원래 ID로 편집한다. */ return props.onEdit(item);
          }}
        />
        <ScheduleButton
          label="일정 삭제"
          disabled={props.disabled}
          onPress={() => {
            /* 기존 삭제 보호를 적용한다. */ return props.onDelete(item);
          }}
        />
      </View>
    )
  );
}
// renderTimelineActions이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderTimelineActionsProps = {
  props: Props & {
    expanded: [string, (id: string) => void];
    arranging: [boolean, (value: boolean) => void];
    largeText: boolean;
  };
  item: WorkspaceSchedule;
};

// 선택 장소의 기록·지출 행동을 표시한다.
export function renderTimelineActions({
  props,
  item,
}: RenderTimelineActionsProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    !props.disabled && (
      <View style={s.cardFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title + ' 사진 추가'}
          onPress={() => {
            /* 앨범 사진을 이 일정에 연결한다. */ return props.onPhoto(item);
          }}
          style={s.inlineAction}
        >
          <TripIcon name="camera-duotone" size={16} />
          <Text style={s.link}>사진 추가</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title + ' 비용 추가'}
          onPress={() => {
            /* 선택 일정의 비용 폼을 연다. */ return props.onExpense(item);
          }}
          style={s.inlineAction}
        >
          <TripIcon
            name="receipt-scan-outline"
            size={16}
            color={theme.color.action.link}
          />
          <Text style={s.link}>비용 추가</Text>
        </Pressable>
      </View>
    )
  );
}

// 이웃한 두 일정의 순서를 바꾼 요청을 만든다.
export function movedIds(
  items: WorkspaceSchedule[],
  index: number,
  offset: number,
): string[] {
  // 원본을 바꾸지 않고 모든 ID를 한 번씩 포함한다.
  return items.map((item, position) => {
    /* 선택 일정과 이웃 일정만 맞바꾼다. */ return (
      items[
        position === index
          ? index + offset
          : position === index + offset
            ? index
            : position
      ]?.id || item.id
    );
  });
}

export const s = tripTimelineStyles;

export { tripTimelineStyles } from './tripTimelineStyles';
