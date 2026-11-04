import type { WorkspaceSchedule } from '@wherego/domain';
import {
  scheduleLocationSchema,
  mapsShareUrlSchema,
} from '@wherego/validation';

export type MapCoordinate = { latitude: number; longitude: number };
export type MapStop = {
  item: WorkspaceSchedule;
  order: number;
  coordinate?: MapCoordinate;
};

// 같은 날짜의 실제 일정만 사용자 방문 순서로 정렬한다.
export function tripMapStops(
  items: WorkspaceSchedule[],
  dayId: string,
): MapStop[] {
  // 원본 배열과 저장 순서는 바꾸지 않는다.
  return items
    .filter((item) => {
      // 다른 날짜의 위치를 연결하지 않는다.
      return item.dayId === dayId;
    })
    .sort((a, b) => {
      // 같은 순서에서는 조회 결과의 원래 순서를 유지한다.
      return a.sortOrder - b.sortOrder;
    })
    .map((item, index) => {
      // 없는 위치를 주소나 도시 중심점으로 추측하지 않는다.
      return {
        item,
        order: index + 1,
        coordinate: scheduleLocationSchema.safeParse(item.location).data,
      };
    });
}

// 위치가 빠진 일정에서는 선을 끊어 확인하지 않은 동선을 만들지 않는다.
export function tripMapLines(stops: MapStop[]): MapCoordinate[][] {
  // 서로 이웃한 실제 위치만 같은 연결선에 넣는다.
  return stops
    .reduce<MapCoordinate[][]>(
      (lines, stop) => {
        // 빠진 위치 뒤에는 새로운 구간을 시작한다.
        return !stop.coordinate
          ? (lines.push([]), lines)
          : (lines.at(-1)!.push(stop.coordinate), lines);
      },
      [[]],
    )
    .filter((line) => {
      // 위치 한 개만 있는 구간에는 선을 표시하지 않는다.
      return line.length > 1;
    });
}

// 기기에 저장된 위치 문자열도 지도에 전달하기 전에 검증한다.
export function savedMapLocation(value = ''): MapCoordinate | undefined {
  // 잘못된 이전 저장 값은 가짜 위치 대신 선택 전 상태로 처리한다.
  try {
    // 서버 계약과 같은 범위 검증을 적용한다.
    return scheduleLocationSchema.safeParse(JSON.parse(value)).data;
  } catch {
    // 읽을 수 없는 값은 지도 핀으로 표시하지 않는다.
    return undefined;
  }
}

// 사용자 입력 좌표나 공식 지도 링크에 명시된 좌표만 읽는다.
export function enteredMapLocation(value: string): MapCoordinate | undefined {
  // 지도 URL의 화면 중심 좌표는 장소 위치로 가져오지 않는다.
  return coordinateText(value.trim()) || coordinateLink(value.trim());
}

// 위도·경도 두 숫자의 범위를 함께 확인한다.
function coordinateText(value: string): MapCoordinate | undefined {
  // 빈 값과 한쪽 좌표만 있는 입력을 거부한다.
  return /^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(value)
    ? scheduleLocationSchema.safeParse({
        latitude: Number(value.split(',')[0]),
        longitude: Number(value.split(',')[1]),
      }).data
    : undefined;
}

// 지도 공식 검색 링크에 직접 포함된 좌표만 해석한다.
function coordinateLink(value: string): MapCoordinate | undefined {
  // 외부 호스트나 단축 링크를 네트워크로 수집하지 않는다.
  return mapsShareUrlSchema.safeParse(value).success
    ? coordinateText(
        new URL(value).searchParams.get('query') ||
          new URL(value).searchParams.get('q') ||
          '',
      )
    : undefined;
}

// 선택한 장소의 길 안내는 외부 지도에서 시작한다.
export function stopMapsUrl(stop: MapStop): string {
  // 이름만 있는 일정도 외부 지도 검색으로 확인할 수 있다.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.coordinate ? `${stop.coordinate.latitude},${stop.coordinate.longitude}` : stop.item.address || stop.item.title)}${!stop.coordinate && stop.item.googlePlaceId ? `&destination_place_id=${encodeURIComponent(stop.item.googlePlaceId)}` : ''}`;
}
