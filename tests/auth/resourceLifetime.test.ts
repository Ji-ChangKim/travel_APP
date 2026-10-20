import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  getCommunity,
  getServerMediaUrl,
  getWorkspace,
  listServerTrips,
  requestFoundation,
  type FoundationClientOptions,
} from '@wherego/api-client';

// 취소될 때까지 연결을 유지하는 전송 계층을 만든다.
function pendingTransport() {
  // 실제 QueryObserver와 API 클라이언트 사이에서 연결 종료를 관찰한다.
  const connections: AbortSignal[] = [];
  const options: FoundationClientOptions = {
    baseUrl: 'https://resource.example.test',
    accessToken: 'test-only',
    fetcher: (_url, init) => {
      // 이미 취소된 입력도 새 연결로 유지하지 않는다.
      return new Promise<Response>((_resolve, reject) => {
        // 연결의 종료 신호는 응답을 기다리는 Promise도 함께 해제한다.
        const signal = init!.signal!;
        connections.push(signal);
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener(
          'abort',
          () => {
            // 네트워크 대기를 성공 자료로 바꾸지 않는다.
            return reject(signal.reason);
          },
          { once: true },
        );
      });
    },
  };
  return { options, connections };
}

test('여행·목록·공개 피드·사진 조회는 화면 취소를 전송 계층까지 전달한다', async () => {
  // 각 읽기 API가 취소된 연결을 남기지 않는지 확인한다.
  const transport = pendingTransport();
  for (const load of [
    (signal: AbortSignal) => {
      // 전체 목록의 연결 수명을 검사한다.
      return listServerTrips(transport.options, signal);
    },
    (signal: AbortSignal) => {
      // 여행 원본의 연결 수명을 검사한다.
      return getWorkspace(transport.options, 'trip', signal);
    },
    (signal: AbortSignal) => {
      // 검색 조건을 바꾼 공개 피드의 연결 수명을 검사한다.
      return getCommunity(transport.options, 0, {}, signal);
    },
    (signal: AbortSignal) => {
      // 만료되는 사진 주소의 연결 수명을 검사한다.
      return getServerMediaUrl(transport.options, 'trip', 'photo', signal);
    },
  ]) {
    const controller = new AbortController();
    const pending = load(controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(transport.connections.at(-1)?.aborted, true);
  }
});

test('읽는 화면이 둘이면 마지막 화면이 떠날 때만 공유 조회를 취소한다', async () => {
  // 한 화면의 종료가 다른 화면의 동일 여행 조회를 취소하지 않게 한다.
  const transport = pendingTransport();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const options = {
    queryKey: ['resource-lifetime', 'trip'],
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      // 실제 조회 클라이언트가 TanStack 취소 신호를 사용한다.
      return getWorkspace(transport.options, 'trip', signal);
    },
  };
  const first = new QueryObserver(client, options);
  const second = new QueryObserver(client, options);
  const releaseFirst = first.subscribe(() => {
    // UI 대신 QueryObserver의 구독 수명만 유지한다.
    return undefined;
  });
  const releaseSecond = second.subscribe(() => {
    // 두 번째 화면도 같은 서버 요청을 공유한다.
    return undefined;
  });
  assert.equal(transport.connections.length, 1);
  releaseFirst();
  assert.equal(transport.connections[0]?.aborted, false);
  releaseSecond();
  assert.equal(transport.connections[0]?.aborted, true);
  await setImmediate();
  assert.equal(client.getQueryData(options.queryKey), undefined);
  client.clear();
});

test('취소를 지원하는 읽기도 통신 제한 시간을 유지한다', async (context) => {
  // 화면이 계속 열려 있어도 응답 없는 연결을 무기한 유지하지 않는다.
  const timeout = new AbortController();
  context.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    // 운영 제한 시간이 전달되는지 확인하고 실제 시간 대기는 생략한다.
    assert.equal(milliseconds, 15000);
    return timeout.signal;
  });
  const transport = pendingTransport();
  const screen = new AbortController();
  const pending = getWorkspace(transport.options, 'trip', screen.signal);
  timeout.abort(new DOMException('Timeout', 'TimeoutError'));
  await assert.rejects(pending, { name: 'TimeoutError' });
  assert.equal(screen.signal.aborted, false);
});

test('사진 조회를 30회 열고 닫아도 진행 중 요청과 비활성 캐시가 누적되지 않는다', async () => {
  // 메모리 바이트 추정 대신 요청과 캐시의 실제 수명 종료를 검사한다.
  const transport = pendingTransport();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  for (let index = 0; index < 30; index += 1) {
    const observer = new QueryObserver(client, {
      queryKey: ['photo-lifetime', index],
      queryFn: ({ signal }) => {
        // 화면마다 다른 사진 연결을 실제 API 클라이언트로 생성한다.
        return getServerMediaUrl(
          transport.options,
          'trip',
          String(index),
          signal,
        );
      },
    });
    const removed = new Promise<void>((resolve) => {
      // 캐시 제거 이벤트를 기다려 임의 지연 시간에 의존하지 않는다.
      const unsubscribe = client.getQueryCache().subscribe((event) => {
        // 이번 사진 캐시가 제거되면 검사 자체의 구독도 즉시 정리한다.
        if (event.type === 'removed') {
          unsubscribe();
          resolve();
        }
      });
    });
    observer.subscribe(() => {
      // 사진 화면이 존재하는 동안만 구독한다.
      return undefined;
    })();
    await removed;
    assert.equal(client.getQueryCache().getAll().length, 0);
    assert.equal(
      transport.connections.some((signal) => !signal.aborted),
      false,
    );
  }
  assert.equal(transport.connections.length, 30);
  client.clear();
});

test('화면 조회 취소가 별도 저장 요청을 중단하거나 재전송하지 않는다', async () => {
  // 화면을 닫더라도 전송을 시작한 쓰기의 확정 결과를 유지한다.
  const screen = new AbortController();
  let calls = 0;
  const options: FoundationClientOptions = {
    baseUrl: 'https://resource.example.test',
    accessToken: 'test-only',
    fetcher: async (_url, init) => {
      // 저장은 화면 취소 신호를 공유하지 않고 한 번만 전송한다.
      calls += 1;
      screen.abort();
      assert.equal(init?.signal?.aborted, false);
      return Response.json({
        data: { saved: true },
        meta: { requestId: 'write' },
      });
    },
  };
  const result = await requestFoundation(options, '/trips/trip/commands', {
    method: 'POST',
    body: JSON.stringify({ operation: 'test' }),
  });
  assert.deepEqual(result.data, { saved: true });
  assert.equal(calls, 1);
});
