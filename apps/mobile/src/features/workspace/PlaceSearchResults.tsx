import Text from '@/components/AppText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { FoundationClientError, searchPlaces } from '@wherego/api-client';
import { z } from 'zod';
import { GoogleAttribution, googlePlaceSchema } from './GooglePlace';
import { serverOptions } from './service';
import { Action } from './ui';
import { styles } from './workspaceStyles';

import { ScheduleButton } from './ScheduleControls';

type Props = {
  userId: string;
  city: string;
  query: string;
  disabled: boolean;
  compact: boolean;
  onSelect: (id: string, title: string) => void;
};
type State = {
  busy: boolean;
  error: string;
  results: z.infer<typeof googlePlaceSchema>[] | null;
};

// 검색 결과는 화면 메모리에서만 확인하고 장소 ID만 편집 폼에 전달한다.
export default function PlaceSearchResults(props: Props) {
  // 부모의 계정·도시·검색어·잠금 변경은 컴포넌트를 교체해 이전 요청을 취소한다.
  const [state, setState] = useState<State>({
    busy: false,
    error: '',
    results: null,
  });
  const active = useRef<AbortController | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Button = props.compact ? ScheduleButton : Action;
  const text = `${props.city} ${props.query.trim()}`.trim();
  useEffect(() => {
    // 화면 종료 뒤 결과·오류·로딩 상태를 갱신하지 않는다.
    return () => {
      // 타이머도 해제해 닫힌 화면에 시간 초과 오류가 표시되지 않게 한다.
      active.current?.abort();
      if (deadline.current) clearTimeout(deadline.current);
    };
  }, []);

  // 클릭 한 번에 요청 하나만 만들고 시간 제한과 취소 상태를 함께 관리한다.
  function startSearch() {
    // 같은 렌더에서 연속 클릭해도 네트워크 요청이 중복되지 않는다.
    if (
      active.current ||
      props.disabled ||
      props.query.trim().length < 2 ||
      text.length > 200
    )
      return;
    const controller = new AbortController();
    active.current = controller;
    setState({ busy: true, error: '', results: null });
    const timer = setTimeout(() => {
      // 오래 걸리는 검색은 직접 입력·외부 지도 이용으로 이어갈 수 있다.
      setState({ busy: false, error: searchError(), results: null });
      controller.abort();
      active.current = null;
    }, 15000);
    deadline.current = timer;
    return void lookupPlaces(props.userId, text, controller.signal)
      .then((results) => {
        // 입력이 바뀌기 전 요청의 결과는 새 화면에 적용하지 않는다.
        return controller.signal.aborted
          ? undefined
          : setState({ busy: false, error: '', results });
      })
      .catch((error: unknown) => {
        // 공급자 원문과 키를 표시하지 않고 다음 행동을 안내한다.
        return controller.signal.aborted
          ? undefined
          : setState({ busy: false, error: searchError(error), results: null });
      })
      .finally(() => {
        // 완료한 요청의 시간 제한과 잠금만 해제한다.
        clearTimeout(timer);
        if (active.current === controller) active.current = null;
      });
  }

  // 검색 결과를 선택해도 일정 저장은 별도의 사용자 확인을 거친다.
  return (
    <View style={{ gap: 10 }} testID="place-search-results">
      <Button
        label={state.busy ? '장소 검색 중…' : '장소 검색'}
        disabled={
          props.disabled ||
          state.busy ||
          props.query.trim().length < 2 ||
          text.length > 200
        }
        onPress={startSearch}
      />
      {props.query.trim().length < 2 || text.length > 200 ? (
        <Text style={styles.subtitle}>
          장소 이름을 두 글자 이상 입력해 주세요. 도시를 포함해 200자까지 검색할
          수 있어요.
        </Text>
      ) : null}
      {state.results ? (
        <>
          <GoogleAttribution />
          {state.results.length === 0 ? (
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              찾은 장소가 없어요. 이름을 바꿔 검색하거나 직접 입력해 주세요.
            </Text>
          ) : null}
          {state.results.map((place) => (
            <View key={place.id} style={{ gap: 8 }}>
              <Text style={styles.subtitle}>{place.address}</Text>
              <Button
                label={`${place.title} 선택`}
                disabled={props.disabled}
                onPress={() => {
                  // 공급자 이름·주소는 저장하지 않고 직접 입력한 제목을 유지한다.
                  return props.onSelect(place.id, props.query.trim());
                }}
              />
              {place.attributions.length > 0 ? (
                <GoogleAttribution attributions={place.attributions} />
              ) : null}
            </View>
          ))}
          {state.results.length > 0 ? (
            <Text style={styles.subtitle}>
              장소를 선택한 뒤 지도 위치를 확인하고 일정을 저장해 주세요.
            </Text>
          ) : null}
        </>
      ) : null}
      {state.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {state.error}
        </Text>
      ) : null}
    </View>
  );
}

// 인증된 현재 검색 경로의 응답을 화면 계약으로 검증한다.
function lookupPlaces(userId: string, query: string, signal: AbortSignal) {
  // 인증 확인 중 화면이 닫힌 요청은 Google 검색까지 진행하지 않는다.
  return serverOptions(userId)
    .then((options) => {
      // 취소된 요청에는 API를 호출하지 않는다.
      return signal.aborted
        ? Promise.reject(new Error('검색 취소'))
        : searchPlaces(options, query, signal);
    })
    .then((response) => {
      // 검증하지 않은 외부 응답을 화면이나 편집 폼에 전달하지 않는다.
      return z.array(googlePlaceSchema).max(10).parse(response.data);
    });
}

// 검색 실패 종류에 맞는 복구 방법만 사용자에게 표시한다.
function searchError(error?: unknown) {
  // 검색을 사용할 수 없어도 직접 입력과 외부 지도 경로는 유지한다.
  return error instanceof FoundationClientError &&
    [401, 403].includes(error.status)
    ? '로그인 후 다시 검색해 주세요. 직접 입력하거나 Google Maps에서 찾을 수도 있어요.'
    : '장소를 찾지 못했어요. 다시 검색하거나 Google Maps에서 찾아 주세요.';
}
