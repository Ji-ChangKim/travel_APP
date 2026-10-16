import Text from '@/components/AppText';
import { useState } from 'react';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { View } from 'react-native';
import type { MapCoordinate, MapStop } from './tripMapModel';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { scheduleTheme as theme } from './scheduleTheme';

export type MapCanvasProps = {
  stops: MapStop[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onPick?: (coordinate: MapCoordinate) => void;
  picking?: boolean;
};

// 웹에서는 모바일 SDK를 불러오거나 유료 웹 지도로 전환하지 않는다.
export default function TripMapCanvas(props: MapCanvasProps) {
  // SVG의 축소 비율과 사용자 글자 배율을 번호 크기에 반영한다.
  const [width, setWidth] = useState(320);
  const { fontScale } = useAppAccessibility();
  // 웹에서는 실제 좌표의 상대 위치를 도식으로 제공한다.
  return (
    <View
      onLayout={(event) => {
        /* 실제 미리보기 너비에서 안쪽 여백만 제외한다. */ return setWidth(
          Math.max(1, event.nativeEvent.layout.width - 24),
        );
      }}
      style={{
        padding: 12,
        gap: 8,
        borderRadius: 16,
        backgroundColor: theme.color.surface.low,
      }}
    >
      <Text
        style={{
          color: theme.color.text.secondary,
          fontSize: 14,
          lineHeight: 22,
          fontFamily: theme.font.regular,
        }}
      >
        방문 위치 · 연결선은 실제 길과 다를 수 있어요.
      </Text>
      {props.stops.some((stop) => {
        // 실제 위치가 하나라도 있을 때만 도식을 표시한다.
        return Boolean(stop.coordinate);
      }) ? (
        <Svg
          width="100%"
          height={180}
          viewBox="0 0 320 180"
          accessibilityLabel="선택한 장소의 위치와 방문 순서"
        >
          {props.stops.map((stop, index, stops) =>
            stop.coordinate ? (
              <ViewPoint
                key={stop.item.id}
                stop={stop}
                previous={index > 0 ? stops[index - 1] : undefined}
                stops={stops}
                selected={props.selectedId === stop.item.id}
                onSelect={props.onSelect}
                scale={Math.max(1, 320 / width)}
                fontScale={fontScale}
              />
            ) : null,
          )}
        </Svg>
      ) : (
        <Text style={{ color: theme.color.text.secondary, lineHeight: 22 }}>
          장소의 위치를 선택하면 방문 순서를 확인할 수 있어요.
        </Text>
      )}
    </View>
  );
}

// 실제 장소 두 개 사이의 선과 번호 핀을 표시한다.
function ViewPoint({
  stop,
  previous,
  stops,
  selected,
  onSelect,
  scale,
  fontScale,
}: {
  stop: MapStop;
  previous?: MapStop;
  stops: MapStop[];
  selected: boolean;
  onSelect?: (id: string) => void;
  scale: number;
  fontScale: number;
}) {
  // 위치가 빠진 장소를 건너뛰어 거짓 연결선을 만들지 않는다.
  return (
    <>
      {previous?.coordinate && (
        <Line
          x1={position(previous, stops).x}
          y1={position(previous, stops).y}
          x2={position(stop, stops).x}
          y2={position(stop, stops).y}
          stroke={theme.color.border.strong}
          strokeWidth={2}
        />
      )}
      <Circle
        cx={position(stop, stops).x}
        cy={position(stop, stops).y}
        r={(selected ? 24 : 22) * scale}
        stroke={theme.color.selection.text}
        strokeWidth={selected ? 3 : 1}
        fill={
          selected ? theme.color.selection.text : theme.color.action.primary
        }
        onPress={() => {
          // 실제 일정 ID를 상위 목록 선택에 전달한다.
          return onSelect?.(stop.item.id);
        }}
      />
      <SvgText
        x={position(stop, stops).x}
        y={position(stop, stops).y + 5 * fontScale * scale}
        textAnchor="middle"
        fill={
          selected ? theme.color.text.inverse : theme.color.action.foreground
        }
        fontSize={14 * fontScale * scale}
        fontFamily={theme.font.semibold}
        fontWeight="600"
        pointerEvents="none"
      >
        {stop.order}
      </SvgText>
    </>
  );
}

// 좌표의 상대 위치를 여백 있는 미리보기 영역으로 옮긴다.
function position(stop: MapStop, stops: MapStop[]): { x: number; y: number } {
  // 실제 지리 거리를 도로 거리나 이동시간으로 해석하지 않는다.
  return {
    x: scaled(
      stop.coordinate!.longitude,
      stops.flatMap((item) => {
        // 확인된 경도만 범위에 포함한다.
        return item.coordinate ? [item.coordinate.longitude] : [];
      }),
      32,
      288,
    ),
    y: scaled(
      -stop.coordinate!.latitude,
      stops.flatMap((item) => {
        // 북쪽 장소를 화면 위에 표시한다.
        return item.coordinate ? [-item.coordinate.latitude] : [];
      }),
      32,
      148,
    ),
  };
}

// 같은 좌표나 한 장소는 가운데에 표시한다.
function scaled(
  value: number,
  values: number[],
  minimum: number,
  maximum: number,
): number {
  // 좌표가 한 종류뿐일 때 0으로 나누지 않는다.
  return Math.max(...values) === Math.min(...values)
    ? (minimum + maximum) / 2
    : minimum +
        ((value - Math.min(...values)) /
          (Math.max(...values) - Math.min(...values))) *
          (maximum - minimum);
}
