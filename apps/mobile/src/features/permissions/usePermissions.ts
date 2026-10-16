import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  type PermissionKind,
  type PermissionSnapshot,
} from './permissionModel';
import {
  permissionGuideKey,
  readPermissions,
  rememberPermissionGuide,
  requestPermission,
  usePermissionGuide,
} from './permissionService';
import { resolvePermission } from './permissionFlow';

// 최초 안내와 설정 복귀 후 실제 권한 상태를 화면 수명에 연결한다.
export function usePermissions() {
  // 중복 요청 잠금과 화면 해제 여부를 상태 갱신보다 먼저 적용한다.
  const active = useRef(false);
  const lock = useRef(false);
  const revision = useRef(0);
  const dismissed = useRef(false);
  const [visible, setVisible] = useState(false);
  const [permissions, setPermissions] = useState<PermissionSnapshot>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requested = usePermissionGuide((state) => {
    // 홈에서 안내를 다시 여는 요청만 구독한다.
    return state.requested;
  });
  // 첫 진입과 운영체제 설정 복귀의 조회를 정리 가능한 효과로 연결한다.
  useEffect(() => {
    // Strict Mode 재연결에서도 이전 효과의 조회 결과를 폐기한다.
    const lifetime = { active: true };
    // 종료된 화면에 늦은 권한 응답을 반영하지 않는다.
    const refresh = () => {
      // 권한 창 처리 중 전경 이벤트가 이전 상태를 덮어쓰지 않게 한다.
      const version = ++revision.current;
      // 설정 복귀 조회는 안내를 강제로 다시 열지 않는다.
      return lock.current
        ? undefined
        : void readPermissions()
            .then((value) => {
              // 현재 화면의 실제 권한 상태만 갱신한다.
              return lifetime.active && version === revision.current
                ? (setPermissions(value), setMessage(''))
                : undefined;
            })
            .catch(() => {
              // 조회 실패 후에도 사용자가 재시도하거나 닫을 수 있다.
              return lifetime.active && version === revision.current
                ? setMessage(
                    '권한을 확인하지 못했어요. 다시 시도하거나 나중에 계속해 주세요.',
                  )
                : undefined;
            });
    };
    const subscription = AppState.addEventListener('change', (state) => {
      // 기기 설정에서 돌아오면 허용 여부를 다시 확인한다.
      return state === 'active' && !lock.current ? refresh() : undefined;
    });
    return (
      (active.current = true),
      refresh(),
      void SecureStore.getItemAsync(permissionGuideKey)
        .then((seen) => {
          // 처음 실행한 기기에서는 두 선택 권한을 안내한다.
          return lifetime.active && !dismissed.current && !seen
            ? setVisible(true)
            : undefined;
        })
        .catch(() => {
          // 저장소 실패 시에도 안내에서 계속 진행할 수 있다.
          return lifetime.active && !dismissed.current
            ? setVisible(true)
            : undefined;
        }),
      () => {
        // 화면 해제 시 설정 복귀 이벤트와 늦은 응답을 차단한다.
        return (
          (lifetime.active = false),
          (active.current = false),
          subscription.remove()
        );
      }
    );
  }, []);
  // 요청 직전에 권한을 다시 확인하여 설정 변경을 반영한다.
  const perform = async (kind: PermissionKind) => {
    // 허용됨·영구 거절·요청 가능 상태별로 실제 동작을 선택한다.
    const version = ++revision.current;
    const current = await resolvePermission(
      kind,
      {
        read: readPermissions,
        request: requestPermission,
        settings: Linking.openSettings,
      },
      () => {
        // 늦은 응답이 이전 요청이나 종료된 화면을 갱신하지 않게 한다.
        return active.current;
      },
    );
    return active.current && version === revision.current && current
      ? (setPermissions(current),
        !current[kind].granted
          ? setMessage(
              '허용하지 않아도 여행을 계속할 수 있어요. 원할 때 다시 설정해 주세요.',
            )
          : undefined)
      : undefined;
  };
  // 선택한 권한 하나의 확인·요청·설정 이동을 연결한다.
  const allow = (kind: PermissionKind) => {
    // 같은 프레임의 연속 탭도 하나의 요청만 실행한다.
    return lock.current
      ? undefined
      : ((lock.current = true),
        setBusy(true),
        setMessage(''),
        perform(kind)
          .catch(() => {
            // 기기 API 실패는 실제 재시도와 닫기 동작으로 복구한다.
            return active.current
              ? setMessage(
                  '권한을 설정하지 못했어요. 다시 시도하거나 나중에 계속해 주세요.',
                )
              : undefined;
          })
          .finally(() => {
            // 종료된 화면은 갱신하지 않고 요청 잠금만 해제한다.
            return (
              (lock.current = false),
              active.current ? setBusy(false) : undefined
            );
          }));
  };
  // 안내 확인 여부를 저장하고 여행 화면으로 돌아간다.
  const close = () => {
    // 허용하지 않은 권한도 앱 이용을 막지 않는다.
    return lock.current
      ? undefined
      : ((dismissed.current = true),
        setVisible(false),
        usePermissionGuide.setState({ requested: false }),
        void rememberPermissionGuide().catch(() => {
          // 저장소 오류가 현재 여행 이용을 막지 않는다.
          return undefined;
        }));
  };
  // 모달이 사용할 상태와 사용자가 실행하는 동작만 제공한다.
  return {
    visible: visible || requested,
    permissions,
    busy,
    message,
    allow,
    close,
  };
}
