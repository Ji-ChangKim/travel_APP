import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import DesignButton from '@/components/DesignButton';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { TripDetailEmpty } from './TripDetailParts';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import { Action } from './ui';
import TripMapCanvas from './TripMapCanvas';
import { stopMapsUrl, tripMapStops } from './tripMapModel';

// 선택 날짜의 실제 일정 위치와 방문 순서를 한 화면에 표시한다.
export default function TripMap({
  snapshot,
  dayId,
  disabled,
  onEdit,
}: {
  snapshot: WorkspaceSnapshot;
  dayId: string;
  disabled: boolean;
  onEdit: (item: WorkspaceSchedule) => void;
}) {
  // 번호 핀과 목록은 같은 배열을 사용하여 방문 순서가 어긋나지 않게 한다.
  const stops = useMemo(() => {
    // 편집 결과나 날짜 변경 때만 위치 목록을 재계산한다.
    return tripMapStops(snapshot.itinerary, dayId);
  }, [snapshot.itinerary, dayId]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const { largeText } = useAppAccessibility();
  // 지도 없이도 제목·위치 선택·외부 길 안내를 이용할 수 있다.
  return (
    <View testID="trip-map-panel" style={s.content}>
      <Text style={s.title}>지도에서 보는 여행</Text>
      <Text style={s.note}>
        번호는 방문 순서예요. 연결선은 장소 사이를 잇는 선으로, 실제 이동 경로와
        다를 수 있어요.
      </Text>
      {stops.length > 0 && (
        <TripMapCanvas
          stops={stops}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      {!stops.length ? (
        <TripDetailEmpty
          title="아직 이날의 일정이 없어요"
          description={
            disabled
              ? '일정이 추가되면 장소와 방문 순서를 함께 볼 수 있어요.'
              : '일정 탭에서 첫 장소를 추가해 보세요.'
          }
        />
      ) : null}
      {stops.some((stop) => {
        // 위치가 빠진 일정은 편집으로 위치 선택을 안내한다.
        return !stop.coordinate;
      }) ? (
        <Text style={s.note}>
          아직 지도 위치를 선택하지 않은 일정이 있어요. 장소에서 ‘위치 선택’을
          눌러 주세요.
        </Text>
      ) : null}
      {stops.map((stop) => (
        <View
          key={stop.item.id}
          style={[s.card, selectedId === stop.item.id && s.selected]}
        >
          <View style={[s.heading, largeText && s.headingLarge]}>
            <Text style={s.number}>{stop.order}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.stopTitle}>{stop.item.title}</Text>
              <Text style={s.note}>
                {stop.item.timeSlot || '시간 미정'}
                {stop.item.address ? ` · ${stop.item.address}` : ''}
                {!stop.coordinate ? ' · 위치 선택 전' : ''}
              </Text>
            </View>
          </View>
          <View style={s.actions}>
            <DesignButton
              label="지도에서 선택"
              size="chip"
              accessibilityLabel={`${stop.order}. ${stop.item.title} 지도에서 선택`}
              selected={stop.item.id === selectedId}
              onPress={() => {
                /* 지도 핀과 목록의 선택을 같은 일정으로 맞춘다. */ return setSelectedId(
                  stop.item.id,
                );
              }}
            />
            <Action
              label="Google Maps 길 안내"
              variant="quiet"
              size="chip"
              onPress={() => {
                // 외부 지도 확인 실패는 다시 시도 가능한 안내로 표시한다.
                return void Linking.openURL(stopMapsUrl(stop))
                  .then(() => {
                    // 성공한 지도 열기의 이전 오류만 지운다.
                    return setError('');
                  })
                  .catch(() => {
                    // 외부 앱 실행 실패가 여행 기록을 바꾸지 않게 한다.
                    return setError(
                      '지도를 열지 못했어요. 잠시 후 다시 시도해 주세요.',
                    );
                  });
              }}
            />
            <Action
              label={stop.coordinate ? '위치 변경' : '위치 선택'}
              size="chip"
              disabled={disabled}
              onPress={() => {
                // 같은 일정의 기존 입력과 날짜를 유지한 편집을 연다.
                return onEdit(stop.item);
              }}
            />
          </View>
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: 14 },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.text,
  },
  note: { fontSize: 14, lineHeight: 22, color: colors.muted },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 12,
  },
  selected: {
    borderColor: colors.selected,
    backgroundColor: colors.selectedSurface,
  },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headingLarge: { flexDirection: 'column', alignItems: 'stretch' },
  number: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 24,
  },
  stopTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.text,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
