import Text from '@/components/AppText';
import { View } from 'react-native';
import { useState } from 'react';
import ScheduleConflictNotice from './scheduleConflicts';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import TripIcon from '@/components/icons/TripIcon';
import type { PlanForm } from './forms';
import { ScheduleButton, ScheduleSection } from './ScheduleControls';
import { scheduleStyles as s, scheduleTheme as theme } from './scheduleTheme';
import { schedulesForDay } from './schedulePresentation';
import { savedMapLocation, tripMapStops } from './tripMapModel';
import TripMapCanvas from './TripMapCanvas';

// 저장 전 일정의 실제 방문 순서를 계산한다.
export function schedulePreviewItems(
  snapshot: WorkspaceSnapshot,
  form: PlanForm,
): WorkspaceSchedule[] {
  // 작성 중인 장소를 기존 목록에 중복해서 넣지 않는다.
  return previewPlacement(
    schedulesForDay(snapshot.itinerary, form.values.dayId || '').filter(
      (item) => {
        // 편집 전의 자기 자신은 미리보기에서 제외한다.
        return item.id !== form.id;
      },
    ),
    {
      id: form.id,
      dayId: form.values.dayId || '',
      title: form.values.title || '추가할 일정',
      type: (form.values.type || 'PLACE') as WorkspaceSchedule['type'],
      timeSlot: form.values.timeSlot || null,
      sortOrder: Number(form.values.sortOrder),
      memo: form.values.memo || null,
      address: form.values.address || '',
      location: savedMapLocation(form.values.mapLocation),
      durationMinutes: Number(form.values.durationMinutes) || null,
    },
    form.values.afterScheduleId,
  );
}

// 선택한 앞 일정 다음에 새 일정을 넣는다.
function previewPlacement(
  items: WorkspaceSchedule[],
  draft: WorkspaceSchedule,
  after?: string,
): WorkspaceSchedule[] {
  // 기존 편집은 저장된 순서를 유지하고 명시적 선택에서만 위치를 바꾼다.
  return after === undefined
    ? [...items, draft].sort((a, b) => {
        // 시간과 방문 순서를 혼동하지 않는다.
        return a.sortOrder - b.sortOrder;
      })
    : [
        ...items.slice(0, insertionIndex(items, after)),
        draft,
        ...items.slice(insertionIndex(items, after)),
      ];
}

// 삽입 기준을 목록 인덱스로 변환한다.
function insertionIndex(items: WorkspaceSchedule[], after: string): number {
  // 마지막과 처음을 별도 선택으로 제공한다.
  return after === 'last'
    ? items.length
    : after === ''
      ? 0
      : Math.max(
          0,
          items.findIndex((item) => {
            // 존재하는 같은 날짜 일정의 위치를 찾는다.
            return item.id === after;
          }) + 1,
        );
}

// 기존 일정 사이에 추가될 장소와 지도 위치를 함께 보여준다.
export default function ScheduleRoutePreview({
  snapshot,
  form,
  disabled,
  onChange,
  showMap = true,
}: {
  snapshot: WorkspaceSnapshot;
  form: PlanForm;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  showMap?: boolean;
}) {
  // 방문 목록과 지도 핀은 같은 미리보기 순서를 사용한다.
  return (
    <RouteContent
      snapshot={snapshot}
      form={form}
      disabled={disabled}
      onChange={onChange}
      items={schedulePreviewItems(snapshot, form)}
      showMap={showMap}
    />
  );
}

// 실제 좌표가 있는 장소만 지도에 표시한다.
function RouteContent({
  snapshot,
  form,
  items,
  disabled,
  onChange,
  showMap,
}: {
  snapshot: WorkspaceSnapshot;
  form: PlanForm;
  items: WorkspaceSchedule[];
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  showMap: boolean;
}) {
  // 기본 미리보기는 새 장소와 앞뒤 방문에 집중하고 전체는 선택해서 펼친다.
  const [expanded, setExpanded] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const draftIndex = items.findIndex((item) => {
    // 편집 중인 장소의 앞뒤 범위를 구한다.
    return item.id === form.id;
  });
  // 없는 거리·소요시간·추천 동선을 만들어 표시하지 않는다.
  return (
    <ScheduleSection
      title={showMap ? '일정 동선 미리보기' : '일정 순서 미리보기'}
      icon="route-outline"
    >
      <ScheduleConflictNotice items={items} />
      {showMap && !items[draftIndex]?.location && (
        <Text style={s.meta}>
          작성 중인 장소의 지도 위치는 아직 없어요. ‘일정의 지도 위치’에서
          지정하면 지도에도 표시돼요.
        </Text>
      )}
      <Text style={s.label}>
        {draftIndex === 0
          ? '이날의 첫 일정으로 추가해요'
          : `‘${items[draftIndex - 1]?.title}’ 다음에 넣어요`}
      </Text>
      <ScheduleButton
        label={choosing ? '삽입 위치 선택 접기' : '삽입 위치 바꾸기'}
        disabled={disabled}
        onPress={() => {
          // 변경할 때만 전체 삽입 후보를 펼친다.
          return setChoosing(!choosing);
        }}
      />
      {choosing && (
        <View style={s.row}>
          <ScheduleButton
            label="맨 앞"
            disabled={disabled}
            selected={form.values.afterScheduleId === ''}
            onPress={() => {
              // 이 날짜의 첫 방문으로 선택한다.
              return (onChange('afterScheduleId', ''), setChoosing(false));
            }}
          />
          {schedulesForDay(snapshot.itinerary, form.values.dayId || '')
            .filter((item) => {
              // 자기 자신은 삽입 기준에서 제외한다.
              return item.id !== form.id;
            })
            .map((item, index) => (
              <ScheduleButton
                key={item.id}
                label={`${index + 1}. ${item.title} 뒤`}
                disabled={disabled}
                selected={form.values.afterScheduleId === item.id}
                onPress={() => {
                  // 선택한 실제 장소 뒤에 삽입한다.
                  return (
                    onChange('afterScheduleId', item.id),
                    setChoosing(false)
                  );
                }}
              />
            ))}
          <ScheduleButton
            label="마지막"
            disabled={disabled}
            selected={form.values.afterScheduleId === 'last'}
            onPress={() => {
              // 선택 날짜의 마지막 순서로 둔다.
              return (onChange('afterScheduleId', 'last'), setChoosing(false));
            }}
          />
        </View>
      )}
      {items.map((item, index) =>
        expanded || Math.abs(index - draftIndex) <= 1 ? (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
              padding: 12,
              borderRadius: 12,
              backgroundColor:
                item.id === form.id
                  ? theme.color.selection.surface
                  : theme.color.surface.low,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  item.id === form.id
                    ? theme.color.selection.text
                    : theme.color.action.primary,
              }}
            >
              <Text
                style={[
                  s.label,
                  {
                    color:
                      item.id === form.id
                        ? theme.color.text.inverse
                        : theme.color.action.foreground,
                  },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={s.label}>{item.title}</Text>
              <Text style={s.meta}>
                {item.timeSlot || '시간 미정'}
                {item.id === form.id ? ' · 작성 중' : ''}
              </Text>
            </View>
            {item.id === form.id && (
              <TripIcon name="map-pin-duotone" size={20} />
            )}
          </View>
        ) : null,
      )}
      {items.length > 3 && (
        <ScheduleButton
          label={
            expanded ? '앞뒤 일정만 보기' : `전체 ${items.length}개 일정 보기`
          }
          onPress={() => {
            // 전체 순서는 필요한 경우에만 펼친다.
            return setExpanded(!expanded);
          }}
        />
      )}
      {showMap &&
        items.some((item) => {
          // 실제 위치가 있는 장소만 지도 확장을 제공한다.
          return Boolean(item.location);
        }) && (
          <ScheduleButton
            label={mapExpanded ? '방문 위치 지도 접기' : '방문 위치 지도 보기'}
            onPress={() => {
              // 방문 순서를 먼저 확인하고 지도는 필요할 때 불러온다.
              return setMapExpanded(!mapExpanded);
            }}
          />
        )}
      {showMap &&
        mapExpanded &&
        items.some((item) => {
          // 하나 이상의 실제 위치가 있어야 지도를 표시한다.
          return Boolean(item.location);
        }) && (
          <TripMapCanvas
            stops={tripMapStops(
              items.map((item, index) => {
                // 미리보기 번호와 지도 번호를 일치시킨다.
                return { ...item, sortOrder: index + 1 };
              }),
              form.values.dayId || '',
            )}
            selectedId={form.id}
          />
        )}
      <Text style={s.meta}>
        {showMap
          ? '방문 순서를 미리 확인해요. 위치를 선택한 장소는 지도에도 표시돼요.'
          : '이날의 일정 순서를 미리 확인해요.'}
      </Text>
    </ScheduleSection>
  );
}
