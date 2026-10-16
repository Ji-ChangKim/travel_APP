import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { colors } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapCanvasProps } from './TripMapCanvas';
import { tripMapLines } from './tripMapModel';

// Android는 기본 Google 지도만 사용하고 Map ID·경로 API를 연결하지 않는다.
export default function TripMapCanvas(props: MapCanvasProps) {
  // 키가 없는 Android 빌드에서는 초기화 오류 대신 복구 안내를 제공한다.
  return Platform.OS === 'android' &&
    !Constants.expoConfig?.extra?.androidMapsEnabled ? (
    <HaruState
      kind="error"
      title="지도를 열 수 없어요"
      description={
        props.picking
          ? 'Google Maps에서 위치를 확인한 뒤 좌표를 붙여 넣어 주세요.'
          : props.stops.length
            ? '아래 장소에서 Google Maps로 확인해 주세요.'
            : '일정 탭에서 장소를 추가한 뒤 Google Maps로 확인해 주세요.'
      }
      compact
    />
  ) : (
    <NativeCanvas {...props} />
  );
}

// 화면에 보이는 동안만 실제 지도와 번호 핀을 유지한다.
function NativeCanvas({
  stops,
  selectedId,
  onSelect,
  onPick,
  picking,
}: MapCanvasProps) {
  // 지도 위치만 읽는 화면은 GPS 권한을 요청하지 않는다.
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  // 지도 타일 지연 안내의 타이머를 화면 수명에 맞춰 정리한다.
  useEffect(() => {
    // 키 제한·네트워크 문제에서도 빈 지도만 계속 표시하지 않는다.
    const timer = !loaded
      ? setTimeout(() => {
          // 이미 로드된 지도는 불필요한 안내를 만들지 않는다.
          return setSlow(true);
        }, 15000)
      : undefined;
    return () => {
      // 탭·편집 화면 종료 시 대기 타이머를 남기지 않는다.
      return clearTimeout(timer);
    };
  }, [loaded]);
  const selected = stops.find((stop) => {
    // 목록 선택은 같은 날짜의 실제 핀 하나로 연결한다.
    return stop.item.id === selectedId;
  })?.coordinate;
  // 지도 준비 이후에만 실제 좌표 범위나 선택 위치로 이동한다.
  useEffect(() => {
    // 모달·탭 해제 시 지도 인스턴스는 React Native가 해제한다.
    return !ready
      ? undefined
      : selected
        ? map.current?.animateCamera(
            { center: selected, zoom: 15 },
            { duration: 280 },
          )
        : stops.some((stop) => {
              // 좌표가 있는 경우에만 화면 범위를 조정한다.
              return Boolean(stop.coordinate);
            })
          ? map.current?.fitToCoordinates(
              stops.flatMap((stop) => {
                // 누락 위치를 임의 중심점으로 대체하지 않는다.
                return stop.coordinate ? [stop.coordinate] : [];
              }),
              {
                edgePadding: { top: 55, left: 45, right: 45, bottom: 55 },
                animated: false,
              },
            )
          : undefined;
  }, [ready, selected, stops]);
  // 지도 공급자 로고와 저작권 영역을 가리지 않는다.
  return (
    <View style={{ gap: 8 }}>
      {slow && !loaded ? (
        <Text accessibilityRole="alert" style={s.message}>
          지도가 늦게 열리고 있어요. 잠시 기다리거나 Google Maps에서 장소를
          확인해 주세요.
        </Text>
      ) : null}
      <View style={s.frame}>
        <MapView
          ref={map}
          style={s.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: 20,
            longitude: 0,
            latitudeDelta: 100,
            longitudeDelta: 160,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onMapReady={() => {
            // 네이티브 지도가 준비된 뒤에만 카메라 조작을 허용한다.
            return setReady(true);
          }}
          onMapLoaded={() => {
            // 실제 지도 타일이 표시되면 지연 타이머를 종료한다.
            return setLoaded(true);
          }}
          onPoiClick={(event) => {
            // 장소 이름을 누른 선택도 좌표만 사용하고 Places 조회는 실행하지 않는다.
            return picking ? onPick?.(event.nativeEvent.coordinate) : undefined;
          }}
          onLongPress={(event) => {
            // 일정 편집 중 사용자가 길게 누른 실제 좌표만 선택한다.
            return picking ? onPick?.(event.nativeEvent.coordinate) : undefined;
          }}
        >
          {tripMapLines(stops).map((coordinates, index) => (
            <Polyline
              key={index}
              coordinates={coordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[8, 5]}
              geodesic
            />
          ))}
          {stops.map((stop) =>
            stop.coordinate ? (
              <Marker
                key={stop.item.id}
                identifier={stop.item.id}
                coordinate={stop.coordinate}
                title={`${stop.order}. ${stop.item.title}`}
                description={stop.item.address || undefined}
                pinColor={
                  stop.item.id === selectedId ? colors.text : colors.brandCoral
                }
                onPress={() => {
                  // 핀 선택으로 아래 장소 카드도 같은 일정에 맞춘다.
                  return onSelect?.(stop.item.id);
                }}
              >
                <View
                  style={[s.pin, stop.item.id === selectedId && s.selected]}
                >
                  <Text
                    style={[
                      s.number,
                      stop.item.id === selectedId && s.selectedNumber,
                    ]}
                  >
                    {stop.order}
                  </Text>
                </View>
              </Marker>
            ) : null,
          )}
        </MapView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  map: { flex: 1 },
  pin: {
    minWidth: 44,
    minHeight: 44,
    padding: 4,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.brandCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.text },
  number: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  selectedNumber: { color: colors.textLight },
  unavailable: {
    padding: 24,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
  },
  message: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
