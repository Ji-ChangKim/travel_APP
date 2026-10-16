import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
export const ModalDepth = createContext(0);
export const ModalActive = createContext(true);
export interface ModalLayer {
  id: symbol;
  depth: number;
  order: number;
  native: boolean;
  strict: boolean;
}
let layers: ModalLayer[] = [];
let revision = 0;
const listeners = new Set<() => void>();

// 가장 위의 읽기·입력 창 하나만 현재 대화창으로 선택한다.
export function topModal(): ModalLayer | undefined {
  // 실제 중첩 깊이를 먼저 사용해 부모의 늦은 등록이 자식을 덮지 않는다.
  return layers.at(-1);
}

// 전역 메뉴와 캐러셀이 현재 모달 상태를 공유한다.
export function useTopModal(): ModalLayer | undefined {
  // 서버에서는 열려 있는 기기 모달을 추측하지 않는다.
  return useSyncExternalStore(subscribe, topModal, noModal);
}

// 화면별 모달 ID와 등록 수명을 연결한다.
export function useModalLayer(
  present: boolean,
  native: boolean,
  strict: boolean,
  priority: number,
) {
  // ID는 다시 렌더링해도 바뀌지 않는다.
  const [id] = useState(() => Symbol('modal'));
  // 부모 창보다 한 단계 위에 표시한다.
  const depth = useContext(ModalDepth) + 1 + priority;
  useLayoutEffect(() => {
    // 닫기 전환이 끝날 때까지 부모나 배경을 활성화하지 않는다.
    return present
      ? register({ id, depth, native, strict, order: ++revision })
      : undefined;
  }, [id, depth, present, native, strict]);
  // 가장 위의 창만 읽기와 닫기를 처리한다.
  const top = useTopModal();
  return {
    id,
    depth,
    active: top?.id === id,
    covered: Boolean(
      top && top.id !== id && (top.native || top.strict || top.depth <= depth),
    ),
  };
}

// 구독자 한 건만 연결한다.
function subscribe(listener: () => void): () => void {
  // 모달 개수에 관계없이 같은 목록을 읽는다.
  listeners.add(listener);
  return () => {
    // 화면 종료 후 상태 수신을 중단한다.
    listeners.delete(listener);
  };
}

// 서버 렌더링의 안정된 빈 상태다.
function noModal(): undefined {
  // 실제 화면 마운트 후 등록한다.
  return undefined;
}

// 중첩 창의 우선순위와 활성 여부를 갱신한다.
function register(layer: ModalLayer): () => void {
  // 같은 ID의 StrictMode 재구독도 중복 등록하지 않는다.
  layers = [
    ...layers.filter((item) => {
      // 기존 같은 창만 교체한다.
      return item.id !== layer.id;
    }),
    layer,
  ].sort((a, b) => {
    // 같은 깊이에서는 마지막에 연 창을 우선한다.
    return a.depth - b.depth || a.order - b.order;
  });
  notify();
  return () => {
    // 종료한 창만 목록에서 빼고 이전 창을 복원한다.
    layers = layers.filter((item) => {
      // 다른 화면의 창은 유지한다.
      return item.id !== layer.id;
    });
    notify();
  };
}

// 변경된 모달 목록을 모든 화면에 알린다.
function notify(): void {
  // 타이머와 하단 메뉴도 같은 최상위 창을 사용한다.
  listeners.forEach((listener) => {
    // 각 구독에는 한 번만 알린다.
    listener();
  });
}
