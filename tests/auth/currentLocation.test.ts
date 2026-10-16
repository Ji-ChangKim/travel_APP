import { locationForeground } from '../../apps/mobile/src/features/permissions/locationForeground';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inspectLocation,
  locateCurrent,
  LocationRequest,
  type LocationPermission,
  type LocationPort,
  type LocationReading,
} from '../../apps/mobile/src/features/permissions/currentLocation';

const granted: LocationPermission = {
  granted: true,
  canAskAgain: true,
  android: { accuracy: 'fine' },
};
const denied: LocationPermission = { granted: false, canAskAgain: true };

// 기기 경계만 바꾸고 실제 위치 판단과 일회 구독을 실행한다.
function fixture(
  permission = granted,
  requested = granted,
  reading: LocationReading = {
    coords: { latitude: 37.5, longitude: 127, accuracy: 15 },
    timestamp: Date.now(),
  },
  services = true,
) {
  // 호출 순서와 구독 정리를 함께 확인한다.
  const calls: string[] = [];
  const port: LocationPort = {
    services: async () => {
      /* 실제 서비스 확인을 기록한다. */ return (
        calls.push('services'),
        services
      );
    },
    permission: async () => {
      /* 실제 권한 조회를 기록한다. */ return (
        calls.push('permission'),
        permission
      );
    },
    request: async () => {
      /* 명시적인 권한 요청을 기록한다. */ return (
        calls.push('request'),
        requested
      );
    },
    watch: async (success) => {
      // 첫 콜백이 구독 핸들보다 먼저 도착하는 경우도 정리한다.
      calls.push('watch');
      success(reading);
      return {
        remove: () => {
          /* 종료된 구독을 센다. */ return void calls.push('remove');
        },
      };
    },
  };
  return { port, calls };
}

// 지연 작업의 응답 순서를 직접 제어한다.
function deferred<T>() {
  // 제품 상태 대신 비동기 경계만 테스트에서 보류한다.
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    /* 지연 응답 핸들을 기록한다. */ resolve = done;
  });
  return { promise, resolve };
}

test('R09 허용 권한은 재요청하지 않고 한 좌표와 측정 반경만 반환한다', async () => {
  // 제목·주소·저장 명령을 만들지 않고 위치 후보만 얻는다.
  const value = fixture();
  assert.deepEqual(
    await locateCurrent(value.port, new AbortController().signal),
    {
      status: 'located',
      fix: {
        coordinate: { latitude: 37.5, longitude: 127 },
        accuracyMeters: 15,
        approximate: false,
      },
    },
  );
  await Promise.resolve();
  assert.ok(!value.calls.includes('request'));
  assert.equal(
    value.calls.filter((item) => {
      /* 구독 정리는 한 번만 실행한다. */ return item === 'remove';
    }).length,
    1,
  );
});

for (const permission of [
  { ...granted, android: { accuracy: 'coarse' as const } },
  {
    granted: true,
    canAskAgain: true,
    ios: { scope: 'whenInUse', accuracy: 'reduced' as const },
  },
]) {
  test(`R09 ${'android' in permission ? 'Android 대략' : 'iOS 제한 정확도'}는 정밀 좌표로 표시하지 않는다`, async () => {
    // 운영체제 정확도 종류를 그대로 안내에 전달한다.
    const value = await locateCurrent(
      fixture(permission).port,
      new AbortController().signal,
    );
    assert.equal(value.status === 'located' && value.fix.approximate, true);
  });
}

test('R09 사용 중·이번만 허용 결과는 그 요청에 쓰고 다음 사용에서 권한을 다시 읽는다', async () => {
  // 과거 허용을 영구 동의로 저장하거나 재사용하지 않는다.
  const first = fixture(denied, granted);
  assert.equal(
    (await locateCurrent(first.port, new AbortController().signal)).status,
    'located',
  );
  const second = fixture({ granted: false, canAskAgain: false });
  assert.deepEqual(
    await locateCurrent(second.port, new AbortController().signal),
    { status: 'denied', canAskAgain: false },
  );
  assert.ok(!second.calls.includes('watch'));
  assert.ok(first.calls.includes('request'));
});

test('R09 요청 거절·영구 거절은 수동 선택을 위한 거절 상태로 남긴다', async () => {
  // 영구 거절에서 운영체제 요청을 반복하지 않는다.
  const first = fixture(denied, { granted: false, canAskAgain: false });
  const second = fixture({ granted: false, canAskAgain: false });
  for (const value of [first, second]) {
    // 거절 결과는 허용 좌표를 만들지 않는다.
    assert.deepEqual(
      await locateCurrent(value.port, new AbortController().signal),
      { status: 'denied', canAskAgain: false },
    );
    assert.ok(!value.calls.includes('watch'));
  }
  assert.ok(!second.calls.includes('request'));
});

test('R09 위치 서비스가 꺼졌으면 권한 창과 구독 없이 설정 상태를 반환한다', async () => {
  // 기기 설정을 확인하기 전에 불필요한 권한 창을 열지 않는다.
  const value = fixture(denied, granted, undefined, false);
  assert.deepEqual(
    await locateCurrent(value.port, new AbortController().signal),
    { status: 'services-off' },
  );
  assert.deepEqual(value.calls, ['services']);
});

test('R09 설정 복귀는 상태만 읽고 권한 요청·위치 구독·후보 적용을 하지 않는다', async () => {
  // 설정에서 허용해도 사용자가 현재 위치 사용을 다시 선택해야 한다.
  const value = fixture();
  assert.deepEqual(
    await inspectLocation(value.port, new AbortController().signal),
    { status: 'ready' },
  );
  assert.deepEqual(value.calls, ['services', 'permission']);
});

test('R09 정확도 누락·잘못된 좌표·오래된 측정은 후보로 쓰지 않는다', async () => {
  // 임의 0,0이나 저장된 과거 위치를 새 측정으로 대체하지 않는다.
  for (const reading of [
    {
      coords: { latitude: 37.5, longitude: 127, accuracy: null },
      timestamp: Date.now(),
    },
    {
      coords: { latitude: 91, longitude: 127, accuracy: 15 },
      timestamp: Date.now(),
    },
    {
      coords: { latitude: NaN, longitude: 127, accuracy: 15 },
      timestamp: Date.now(),
    },
    {
      coords: { latitude: 37.5, longitude: 127, accuracy: -1 },
      timestamp: Date.now(),
    },
    {
      coords: { latitude: 37.5, longitude: 127, accuracy: 15 },
      timestamp: Date.now() - 61000,
    },
  ]) {
    // 실패한 측정에는 적용 가능한 좌표 객체가 없다.
    assert.deepEqual(
      await locateCurrent(
        fixture(granted, granted, reading).port,
        new AbortController().signal,
      ),
      { status: 'inaccurate' },
    );
  }
});

test('R09 권한 조회 뒤 화면이 닫히면 지연 응답이 권한 창을 열지 않는다', async () => {
  // 취소할 수 없는 운영체제 조회 응답도 후속 작업을 만들지 않는다.
  const value = fixture(denied);
  const pending = deferred<LocationPermission>();
  value.port.permission = () => {
    /* 권한 확인 응답만 보류한다. */ return pending.promise;
  };
  const controller = new AbortController();
  const result = locateCurrent(value.port, controller.signal);
  await Promise.resolve();
  controller.abort();
  pending.resolve(denied);
  await assert.rejects(result, /취소/);
  assert.ok(!value.calls.includes('request'));
  assert.ok(!value.calls.includes('watch'));
});

test('R09 요청 중 화면을 닫으면 늦은 허용 응답이 위치 구독을 시작하지 않는다', async () => {
  // 운영체제 권한 창에서 돌아온 뒤에도 원래 폼 수명을 확인한다.
  const value = fixture(denied);
  const pending = deferred<LocationPermission>();
  value.port.request = () => {
    /* OS 선택 결과를 지연한다. */ return pending.promise;
  };
  const controller = new AbortController();
  const result = locateCurrent(value.port, controller.signal);
  await new Promise<void>((resolve) => {
    /* 권한 요청 시작까지 처리한다. */ return setImmediate(resolve);
  });
  controller.abort();
  pending.resolve(granted);
  await assert.rejects(result, /취소/);
  assert.ok(!value.calls.includes('watch'));
});

test('R09 연타는 한 요청만 실행하고 종료된 폼의 늦은 결과는 반영하지 않는다', async () => {
  // 요청 잠금과 결과 전달을 같은 요청 식별자로 제한한다.
  const request = new LocationRequest();
  const pending = deferred<number>();
  const accepted: number[] = [];
  let calls = 0;
  const work = () => {
    /* 같은 프레임의 실제 작업 수를 기록한다. */ calls += 1;
    return pending.promise;
  };
  const accept = (value: number) => {
    /* 반영된 후보만 기록한다. */ accepted.push(value);
  };
  const ignore = () => {
    /* 다른 상태를 변경하지 않는다. */ return undefined;
  };
  const active = () => {
    /* 현재 요청이 속한 화면만 허용한다. */ return true;
  };
  const first = request.run(work, accept, ignore, ignore, active);
  await request.run(work, accept, ignore, ignore, active);
  assert.equal(calls, 1);
  request.cancel();
  pending.resolve(1);
  await first;
  assert.deepEqual(accepted, []);
});

test('R09 이전 요청의 늦은 정리는 새 요청의 진행 표시를 풀지 않는다', async () => {
  // 이전 폼·수동 선택·재조회가 교차해도 최신 요청만 완료할 수 있다.
  const request = new LocationRequest();
  const old = deferred<number>();
  const fresh = deferred<number>();
  const accepted: number[] = [];
  let finished = 0;
  const accept = (value: number) => {
    /* 최신 적용 후보만 기록한다. */ accepted.push(value);
  };
  const fail = () => {
    /* 이 시나리오에는 정상 응답만 제공한다. */ assert.fail('오류 반영 금지');
  };
  const finish = () => {
    /* 현재 요청의 완료 횟수를 기록한다. */ finished += 1;
  };
  const active = () => {
    /* 두 요청의 화면 조건은 같고 요청 ID만 다르다. */ return true;
  };
  const previous = request.run(
    () => {
      /* 이전 응답을 보류한다. */ return old.promise;
    },
    accept,
    fail,
    finish,
    active,
  );
  await Promise.resolve();
  request.cancel();
  const next = request.run(
    () => {
      /* 새 응답을 별도로 보류한다. */ return fresh.promise;
    },
    accept,
    fail,
    finish,
    active,
  );
  old.resolve(1);
  await previous;
  assert.equal(request.busy, true);
  assert.equal(finished, 0);
  fresh.resolve(2);
  await next;
  assert.deepEqual(accepted, [2]);
  assert.equal(finished, 1);
});

test('R09 예약 직후 폼이 비활성화되면 위치 작업 자체를 시작하지 않는다', async () => {
  // 렌더와 효과 정리 사이에도 화면 조건을 다시 확인한다.
  const request = new LocationRequest();
  let active = true;
  let calls = 0;
  const ignore = () => {
    /* 비활성 화면의 상태를 변경하지 않는다. */ return undefined;
  };
  const pending = request.run(
    async () => {
      /* 실행된 운영체제 작업을 기록한다. */ calls += 1;
      return 1;
    },
    ignore,
    ignore,
    ignore,
    () => {
      /* 현재 화면 조건을 읽는다. */ return active;
    },
  );
  active = false;
  await pending;
  assert.equal(calls, 0);
  assert.equal(request.busy, false);
});

test('R09 권한 응답 뒤 실제 전경 복귀까지 기다리고 구독을 해제한다', async () => {
  // OS 권한 창과 앱 전경 이벤트가 역순으로 도착할 수 있다.
  let active = false;
  let resume!: () => void;
  let removed = 0;
  let finished = false;
  const waiting = locationForeground(
    {
      active: () => {
        /* 실제 앱 상태를 읽는다. */ return active;
      },
      subscribe: (callback) => {
        /* 복귀 이벤트만 보류한다. */ resume = callback;
        return () => {
          /* 완료한 구독을 센다. */ removed += 1;
        };
      },
    },
    new AbortController().signal,
  ).then(() => {
    /* 전경 복귀 전에는 완료되지 않는다. */ finished = true;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  active = true;
  resume();
  await waiting;
  assert.equal(removed, 1);
});

test('R09 전경 복귀 대기 중 폼 취소는 늦은 복귀로 위치 요청을 되살리지 않는다', async () => {
  // 취소 뒤에도 이벤트가 도착할 수 있는 경계를 검사한다.
  const controller = new AbortController();
  let resume!: () => void;
  let removed = 0;
  const waiting = locationForeground(
    {
      active: () => {
        /* 백그라운드 상태를 유지한다. */ return false;
      },
      subscribe: (callback) => {
        /* 지연 이벤트 핸들을 보관한다. */ resume = callback;
        return () => {
          /* 취소 구독을 정리한다. */ removed += 1;
        };
      },
    },
    controller.signal,
  );
  await Promise.resolve();
  controller.abort();
  resume();
  await assert.rejects(waiting, /취소/);
  assert.equal(removed, 1);
});
