import {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ModalActive } from '../accessibility/modalLayers';
import { AppState } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { useIsFocused } from 'expo-router';
import {
  inspectLocation,
  locateCurrent,
  LocationRequest,
  type LocationResult,
} from './currentLocation';
import { locationPort, openLocationSettings } from './locationService';
import { locationForeground } from './locationForeground';

// 화면 수명과 저장 잠금을 일회 위치 요청에 연결한다.
export function useCurrentLocation(enabled: boolean) {
  // 폼 키가 바뀌어 다시 마운트되면 이전 요청 객체도 함께 폐기된다.
  const [request] = useState(() => {
    // 요청 조정자는 렌더 중 ref를 읽지 않고 폼 수명에 한 번만 만든다.
    return new LocationRequest();
  });
  const [store] = useState(() => {
    // 외부 이벤트의 진행 상태를 이번 폼만 구독하는 저장소에 둔다.
    return createStore<{ busy: boolean; result?: LocationResult }>(() => {
      // 초기에는 측정한 현재 위치나 진행 요청이 없다.
      return { busy: false };
    });
  });
  const { busy, result } = useStore(store);
  const modalActive = useContext(ModalActive);
  const focused = useIsFocused() && modalActive;
  const alive = useRef(false);
  const available = useRef(false);
  const settingsOpened = useRef(false);
  const revision = useRef(0);
  const permissionPrompt = useRef<AbortSignal | null>(null);
  // 결과를 반영하기 직전 화면과 폼 잠금을 다시 확인한다.
  const active = useCallback((): boolean => {
    // 숨겨진 화면과 요청 중인 저장 폼은 갱신하지 않는다.
    return alive.current && available.current;
  }, []);
  // 현재 위치 또는 설정 상태 확인을 같은 요청 잠금으로 실행한다.
  const run = useCallback(
    (inspect = false): void => {
      // 연타와 비활성 화면의 운영체제 호출을 차단한다.
      return request.busy || !active()
        ? undefined
        : void ((revision.current += 1),
          store.setState({ busy: true, result: undefined }),
          request.run(
            (signal) => {
              // 설정 복귀는 상태만 읽고 위치 요청은 사용자가 다시 선택한다.
              return inspect
                ? inspectLocation(locationPort, signal)
                : locateCurrent(
                    {
                      ...locationPort,
                      request: async () => {
                        // 권한 창의 일시적인 비활성 상태를 실제 앱 이탈과 구분한다.
                        permissionPrompt.current = signal;
                        try {
                          const permission = await locationPort.request();
                          await locationForeground(
                            {
                              active: () => {
                                /* 전경 상태를 실제로 확인한다. */ return (
                                  AppState.currentState === 'active'
                                );
                              },
                              subscribe: (resume) => {
                                // OS 권한 응답보다 늦은 전경 이벤트를 기다린다.
                                const listener = AppState.addEventListener(
                                  'change',
                                  resume,
                                );
                                return () => {
                                  /* 복귀 대기가 끝나면 이벤트를 해제한다. */ return listener.remove();
                                };
                              },
                            },
                            signal,
                          );
                          return permission;
                        } finally {
                          // 이전 권한 창의 정리가 새 요청 상태를 덮지 못하게 한다.
                          if (permissionPrompt.current === signal)
                            permissionPrompt.current = null;
                        }
                      },
                    },
                    signal,
                  );
            },
            (result) => {
              // 유효한 현재 요청만 외부 이벤트 상태를 갱신한다.
              return store.setState({ result });
            },
            () => {
              // 내부 오류 대신 수동 선택과 재시도가 가능한 상태를 제공한다.
              return store.setState({ result: { status: 'unavailable' } });
            },
            () => {
              // 현재 요청이 끝난 경우에만 진행 표시를 해제한다.
              return store.setState({ busy: false });
            },
            active,
          ));
    },
    [request, active, store],
  );
  // 수동 선택과 접기는 이전 GPS 결과를 더 이상 기다리지 않는다.
  const clear = useCallback((): void => {
    // 원래 일정 폼의 위치는 건드리지 않는다.
    return void ((revision.current += 1),
    request.cancel(),
    store.setState({ busy: false, result: undefined }));
  }, [request, store]);
  return (
    useLayoutEffect(() => {
      // 효과 재연결에서도 이전 요청은 취소하고 새 수명으로 시작한다.
      alive.current = true;
      available.current = enabled && focused;
      if (!available.current) settingsOpened.current = false;
      store.setState({ busy: false, result: undefined });
      const subscription = AppState.addEventListener('change', (state) => {
        // 권한 팝업의 일시 inactive는 허용하되 백그라운드 추적은 중단한다.
        return state === 'background'
          ? permissionPrompt.current && !permissionPrompt.current.aborted
            ? undefined
            : clear()
          : state === 'active' && settingsOpened.current && active()
            ? ((settingsOpened.current = false), run(true))
            : undefined;
      });
      return () => {
        // 종료·폼 변경·잠금·화면 이동 뒤의 늦은 응답을 폐기한다.
        return void ((alive.current = false),
        request.cancel(),
        subscription.remove());
      };
    }, [request, enabled, focused, clear, active, run, store]),
    {
      busy,
      result,
      isActive: active,
      locate: () => {
        // 현재 위치는 매번 권한부터 다시 확인한다.
        return run();
      },
      clear,
      settings: () => {
        // 명시적인 설정 버튼에서만 외부 화면을 열고 복귀 시 상태를 재확인한다.
        if (!active()) return;
        const servicesOff = result?.status === 'services-off';
        clear();
        const version = revision.current;
        settingsOpened.current = true;
        return void openLocationSettings(servicesOff).catch(() => {
          // 오래된 설정 실행 실패도 새 조회나 종료된 폼을 덮지 못한다.
          return active() && version === revision.current
            ? ((settingsOpened.current = false),
              store.setState({ result: { status: 'unavailable' } }))
            : undefined;
        });
      },
    }
  );
}
