import {
  useState,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import { Text, View } from 'react-native';
import { mapsSharePreviewSchema, sharedMapsUrl } from '@wherego/validation';
import { requestFoundation } from '@wherego/api-client';
import { serverOptions } from './service';
import { Action, Field, styles } from './ui';

type State = {
  text: string;
  busy: boolean;
  error: string;
  preview: { query: string; googlePlaceId: string } | null;
};
type Set = Dispatch<SetStateAction<State>>;
type Props = {
  userId: string;
  disabled: boolean;
  initialText?: string;
  onQuery: (query: string) => void;
  onSelect: (id: string, title: string) => void;
};

// 변경한 공유문과 요청 상태를 동일한 입력 상태로 보관한다.
function patch(set: Set, values: Partial<State>): void {
  // 완료가 늦은 응답은 호출자에서 요청 번호로 구분한다.
  return set((state) => {
    // 지정한 필드만 갱신하고 다른 입력은 유지한다.
    return { ...state, ...values };
  });
}

// 새 검색 입력은 이전 공유 링크 요청을 무효화한다.
function nextRequest(request: RefObject<number>): number {
  // 같은 링크를 연속 확인하더라도 최신 요청만 적용한다.
  return ++request.current;
}

// 요청 번호가 여전히 최신인 경우만 결과를 반영한다.
function applyCurrent(
  request: RefObject<number>,
  id: number,
  set: Set,
  values: Partial<State>,
): void {
  // 사용자가 고친 링크에 이전 결과가 덮어쓰이지 않게 한다.
  return request.current === id ? patch(set, values) : undefined;
}

// 공유 링크 하나를 인증된 서버에서 확인한다.
function importLink(
  props: Props,
  state: State,
  set: Set,
  request: RefObject<number>,
  id: number,
): void {
  // 링크 후보를 일정으로 저장하기 전에 사용자가 확인한다.
  return void Promise.resolve(
    patch(set, { busy: true, error: '', preview: null }),
  )
    .then(() => {
      // 클라이언트에서도 Google 지도 한 개 링크를 검증한다.
      return sharedMapsUrl(state.text);
    })
    .then((text) => {
      // 서버에 현재 사용자 세션만 전달한다.
      return serverOptions(props.userId).then((options) => {
        // 단축 주소 해석은 API 서버가 제한된 Google 호스트에서 수행한다.
        return requestFoundation(
          options,
          `/places/import?text=${encodeURIComponent(text)}`,
        );
      });
    })
    .then((response) => {
      // 미리보기 계약이 유효한 경우에만 결과를 표시한다.
      return applyCurrent(request, id, set, {
        preview: mapsSharePreviewSchema.parse(response.data),
      });
    })
    .catch(() => {
      // 저장 목록·지원하지 않는 링크는 장소별 공유 또는 직접 검색을 안내한다.
      return applyCurrent(request, id, set, {
        error:
          '장소 링크를 확인하지 못했습니다. 저장 목록에서 장소 하나를 공유하거나 이름으로 검색해 주세요.',
      });
    })
    .finally(() => {
      // 새 요청의 로딩 상태를 이전 요청이 변경하지 않는다.
      return applyCurrent(request, id, set, { busy: false });
    });
}

// 주소 확인 결과는 명시적 선택 후 장소 검색 또는 일정 편집에 반영한다.
function SharedPlaceView({
  props,
  state,
  set,
  request,
}: {
  props: Props;
  state: State;
  set: Set;
  request: RefObject<number>;
}) {
  // 외부 페이지의 원문을 표시하지 않고 검증한 후보만 보여준다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Google Maps 공유 장소 가져오기</Text>
      <Text style={styles.subtitle}>
        저장한 장소에서 공유 → 링크 복사 후 붙여 넣어 주세요. 장소 하나씩 여행에
        추가할 수 있어요.
      </Text>
      <Field
        label="Google Maps 공유 링크"
        value={state.text}
        onChange={(text) => {
          // 입력 변경은 진행 중인 이전 요청을 무효화한다.
          return void Promise.resolve(nextRequest(request)).then(() => {
            // 최신 링크의 미리보기는 새 확인을 요청한다.
            return patch(set, { text, preview: null, busy: false, error: '' });
          });
        }}
      />
      <Action
        label={state.busy ? '링크 확인 중…' : '공유 링크 확인'}
        disabled={props.disabled || state.busy || !state.text.trim()}
        onPress={() => {
          // 현재 링크의 후보를 조회한다.
          return importLink(props, state, set, request, nextRequest(request));
        }}
      />
      {state.preview && (
        <>
          <Text>{state.preview.query || 'Google 장소 ID를 확인했습니다.'}</Text>
          <Action
            label={
              state.preview.googlePlaceId
                ? '이 장소 선택'
                : '이 장소 이름으로 검색'
            }
            disabled={props.disabled}
            onPress={() => {
              // 추출한 이름은 최종 저장 전에 사용자가 제목과 장소를 확인한다.
              return state.preview!.googlePlaceId
                ? props.onSelect(
                    state.preview!.googlePlaceId,
                    state.preview!.query,
                  )
                : props.onQuery(state.preview!.query);
            }}
          />
        </>
      )}
      {state.error && (
        <Text style={styles.error} accessibilityRole="alert">
          {state.error}
        </Text>
      )}
    </View>
  );
}

// 팝업별 공유 링크 상태를 분리한다.
export default function SharedPlaceInput(props: Props) {
  // 기존 편집 팝업의 생명주기와 같은 상태를 사용한다.
  return (
    <SharedPlaceState
      props={props}
      statePair={useState<State>({
        text: props.initialText || '',
        busy: false,
        error: '',
        preview: null,
      })}
      request={useRef(0)}
    />
  );
}

// 상태 훅을 공유 입력 화면에 연결한다.
function SharedPlaceState({
  props,
  statePair: [state, set],
  request,
}: {
  props: Props;
  statePair: [State, Set];
  request: RefObject<number>;
}) {
  // 가져오기 후보는 서버 DB에 자동 저장하지 않는다.
  return (
    <SharedPlaceView props={props} state={state} set={set} request={request} />
  );
}
