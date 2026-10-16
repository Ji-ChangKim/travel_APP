import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePermission } from '../../apps/mobile/src/features/permissions/permissionFlow';
import {
  currentLocationUrl,
  type PermissionKind,
  type PermissionSnapshot,
  type PermissionStatus,
} from '../../apps/mobile/src/features/permissions/permissionModel';
import { oneShotLocation } from '../../apps/mobile/src/features/permissions/oneShotLocation';

const granted: PermissionStatus = { granted: true, canAskAgain: false };
const denied: PermissionStatus = { granted: false, canAskAgain: true };
const blocked: PermissionStatus = { granted: false, canAskAgain: false };

// 운영체제 경계를 기록하는 권한 어댑터를 만든다.
function port(snapshot: PermissionSnapshot, result = granted) {
  // 허용 상태와 요청 대상을 독립적으로 검증한다.
  const calls: string[] = [];
  return {
    calls,
    read: () => {
      // 매 요청 직전의 실제 기기 상태를 반환한다.
      return Promise.resolve(snapshot);
    },
    request: (kind: PermissionKind) => {
      // 어떤 운영체제 권한을 요청했는지 기록한다.
      return (calls.push(kind), Promise.resolve(result));
    },
    settings: () => {
      // 영구 거절은 추가 요청 대신 설정으로 이동한다.
      return (calls.push('settings'), Promise.resolve());
    },
  };
}

test('위치 허용 요청은 알림 상태를 바꾸지 않는다', async () => {
  // 알림을 거절해도 위치를 개별 허용할 수 있다.
  const adapter = port({ notifications: denied, location: denied });
  assert.deepEqual(
    await resolvePermission('location', adapter, () => {
      // 현재 화면의 수명만 제공한다.
      return true;
    }),
    { notifications: denied, location: granted },
  );
  assert.deepEqual(adapter.calls, ['location']);
});

test('이미 허용한 알림은 다시 요청하지 않는다', async () => {
  // 설정에서 허용된 뒤 오래된 화면 버튼을 눌러도 재요청하지 않는다.
  const adapter = port({ notifications: granted, location: denied });
  await resolvePermission('notifications', adapter, () => {
    // 현재 화면의 수명만 제공한다.
    return true;
  });
  assert.deepEqual(adapter.calls, []);
});

test('다시 묻기 불가 상태는 기기 설정으로 이동한다', async () => {
  // 영구 거절 뒤 가짜 허용 상태를 만들지 않는다.
  const adapter = port({ notifications: blocked, location: denied });
  assert.equal(
    (
      await resolvePermission('notifications', adapter, () => {
        // 현재 화면의 수명만 제공한다.
        return true;
      })
    )?.notifications.granted,
    false,
  );
  assert.deepEqual(adapter.calls, ['settings']);
});

test('거절 응답을 허용으로 바꾸지 않는다', async () => {
  // 사용자의 선택을 그대로 보관하고 다음 동작에 사용한다.
  const adapter = port({ notifications: denied, location: denied }, blocked);
  assert.equal(
    (
      await resolvePermission('location', adapter, () => {
        // 현재 화면의 수명만 제공한다.
        return true;
      })
    )?.location.canAskAgain,
    false,
  );
});

test('권한 조회 중 화면을 떠나면 운영체제 창을 열지 않는다', async () => {
  // 늦은 비동기 조회 이후의 팝업 실행을 검출한다.
  const adapter = port({ notifications: denied, location: denied });
  assert.equal(
    await resolvePermission('location', adapter, () => {
      // 종료된 화면 수명을 제공한다.
      return false;
    }),
    undefined,
  );
  assert.deepEqual(adapter.calls, []);
});

test('유효한 실제 좌표만 지도 링크에 넣는다', () => {
  // 누락·무한대·범위를 벗어난 좌표를 외부 지도에 전달하지 않는다.
  assert.equal(
    currentLocationUrl({ latitude: 37.5, longitude: 127 }),
    'https://www.google.com/maps/search/?api=1&query=37.5,127',
  );
  assert.equal(
    currentLocationUrl({ latitude: NaN, longitude: 127 }),
    undefined,
  );
  assert.equal(currentLocationUrl({ latitude: 91, longitude: 127 }), undefined);
  assert.equal(
    currentLocationUrl({ latitude: 37, longitude: Infinity }),
    undefined,
  );
});

test('위치 첫 응답이 구독 생성보다 빨라도 구독을 해제한다', async () => {
  // 네이티브 콜백과 구독 반환의 역순 도착을 재현한다.
  let removed = 0;
  assert.equal(
    await oneShotLocation<number>((success) => {
      // 먼저 위치를 받은 뒤 해제 핸들을 반환한다.
      return (
        success(37),
        Promise.resolve({
          remove: () => {
            // 늦게 받은 핸들도 한 번 해제되어야 한다.
            return void (removed += 1);
          },
        })
      );
    }, new AbortController().signal),
    37,
  );
  await new Promise<void>((resolve) => {
    // 구독 반환 콜백까지 처리한다.
    return setImmediate(resolve);
  });
  assert.equal(removed, 1);
});

test('시간 초과 후 늦게 도착한 위치 구독도 해제한다', async () => {
  // 응답 없는 위치 서비스가 무한 추적을 만들지 않는다.
  let connect: ((value: { remove: () => void }) => void) | undefined;
  let removed = 0;
  await assert.rejects(
    oneShotLocation<number>(
      () => {
        // 시간 초과 이후까지 네이티브 구독 생성 응답을 지연한다.
        return new Promise((resolve) => {
          // 테스트가 지연 응답 시점을 직접 제어한다.
          return void (connect = resolve);
        });
      },
      new AbortController().signal,
      5,
    ),
    /위치를 확인하지 못했어요/,
  );
  connect?.({
    remove: () => {
      // 종료된 작업에 도착한 구독을 해제한다.
      return void (removed += 1);
    },
  });
  await new Promise<void>((resolve) => {
    // 지연 구독의 정리까지 처리한다.
    return setImmediate(resolve);
  });
  assert.equal(removed, 1);
});

test('화면 종료 취소는 실행 중 위치 구독을 해제한다', async () => {
  // 사용자 화면 이탈 뒤 좌표 구독이 남지 않게 한다.
  const controller = new AbortController();
  let removed = 0;
  const result = oneShotLocation<number>(() => {
    // 좌표 없이 활성 구독만 반환한다.
    return Promise.resolve({
      remove: () => {
        // 종료 시 한 번만 해제한다.
        return void (removed += 1);
      },
    });
  }, controller.signal);
  await new Promise<void>((resolve) => {
    // 구독 연결 후 화면 종료를 재현한다.
    return setImmediate(resolve);
  });
  controller.abort();
  await assert.rejects(result, /취소/);
  assert.equal(removed, 1);
});

test('이미 취소된 화면에서는 위치 구독을 시작하지 않는다', async () => {
  // 화면 종료 직후 시작되는 비동기 작업도 차단한다.
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    oneShotLocation(() => {
      // 취소 후 네이티브 호출이 실행되면 검증 실패다.
      throw new Error('구독 호출됨');
    }, controller.signal),
    /취소/,
  );
});
