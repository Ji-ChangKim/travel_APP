import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appConfigSchema,
  playStoreUrl,
  type AppConfig,
} from '@wherego/validation';
import {
  decideUpdate,
  failedStartupChecks,
  policyLifetime,
  usablePolicyCache,
  type PolicyCache,
} from '../../apps/mobile/src/features/startup/updatePolicy';
import { loadAppPolicy } from '../../apps/mobile/src/features/startup/policyClient';

const policy: AppConfig = {
  platform: 'android',
  channel: 'play',
  latestVersionCode: 30,
  minSupportedVersionCode: 20,
  storeUrl: playStoreUrl,
  checkedAt: new Date().toISOString(),
};
const play = {
  status: 'available',
  channel: 'play',
  installedVersionCode: 10,
  availableVersionCode: 30,
  immediateAllowed: true,
};

test('R08 최신·더 높은 설치·선택·필수·스토어 대체 업데이트를 구분한다', () => {
  // 설정된 최신 번호보다 높은 테스트 빌드를 강제로 낮추지 않는다.
  return assert.deepEqual(
    [
      decideUpdate(policy, { ...play, installedVersionCode: 30 }),
      decideUpdate(policy, {
        ...play,
        installedVersionCode: 40,
        availableVersionCode: 50,
      }),
      decideUpdate(policy, { ...play, installedVersionCode: 20 }),
      decideUpdate(policy, play),
      decideUpdate(policy, { ...play, immediateAllowed: false }),
    ].map((item) => {
      // 판단 결과와 실제 실행 방법을 함께 비교한다.
      return [item.kind, item.action];
    }),
    [
      ['pass', 'none'],
      ['pass', 'none'],
      ['optional', 'store'],
      ['required', 'immediate'],
      ['required', 'store'],
    ],
  );
});

test('R08 필수 정책은 있으나 단계 배포·조회 실패·설치 버전 부족이면 재확인한다', () => {
  // 최소 지원 버전에 도달할 수 없는 업데이트를 자동 반복하지 않는다.
  return assert.deepEqual(
    [
      decideUpdate(policy, {
        ...play,
        status: 'current',
        availableVersionCode: null,
      }),
      decideUpdate(policy, { ...play, status: 'unavailable' }),
      decideUpdate(policy, { ...play, availableVersionCode: 15 }),
    ],
    Array(3).fill({ kind: 'blocked', action: 'none' }),
  );
});

test('R08 직접 설치·알 수 없는 채널·설치 번호 부재에는 Play 필수 정책을 적용하지 않는다', () => {
  // 다른 배포 채널의 설치 가능성을 Play 결과로 추측하지 않는다.
  return assert.deepEqual(
    [
      decideUpdate(policy, { ...play, channel: 'direct' }),
      decideUpdate(policy, { ...play, channel: 'unknown' }),
      decideUpdate(policy, { status: 'unavailable', channel: 'play' }),
    ],
    Array(3).fill({ kind: 'pass', action: 'none' }),
  );
});

test('R08 정책이 없어도 Play의 실제 선택 업데이트는 유지하며 조회 실패는 차단하지 않는다', () => {
  // 미확정 운영값에서 임의 최소 버전을 만들지 않는다.
  return assert.deepEqual(
    [
      decideUpdate(null, play),
      decideUpdate(null, { ...play, status: 'unavailable' }),
    ],
    [
      { kind: 'optional', action: 'store' },
      { kind: 'pass', action: 'none' },
    ],
  );
});

test('R08 정책은 최소·최신 정수 범위와 공식 앱 상세 URL을 검증한다', () => {
  // 다른 패키지·호스트·추가 필드로 업데이트 목적을 바꿀 수 없다.
  return assert.deepEqual(
    [
      { ...policy, minSupportedVersionCode: 31 },
      { ...policy, minSupportedVersionCode: -1 },
      { ...policy, latestVersionCode: 2.5 },
      { ...policy, storeUrl: playStoreUrl + '&id=evil.app' },
      { ...policy, storeUrl: 'https://play.google.com.evil.test/store' },
      { ...policy, channel: 'direct' },
      { ...policy, injected: true },
    ].map((value) => {
      // 같은 스키마를 API·캐시·기기 응답에 적용한다.
      return appConfigSchema.safeParse(value).success;
    }),
    Array(7).fill(false),
  );
});

test('R08 캐시 수신 시각은 24시간 미만만 유효하고 미래·손상·다른 채널은 거부한다', () => {
  // 정책 생성 시각을 수신 시각으로 바꿔 유효기간을 늘리지 않는다.
  const now = Date.now();
  const cache = { policy, receivedAt: now - policyLifetime + 1 };
  assert.deepEqual(usablePolicyCache(cache, now), cache);
  assert.deepEqual(
    [
      { policy, receivedAt: now - policyLifetime },
      { policy, receivedAt: now + 1 },
      { policy: { ...policy, channel: 'direct' }, receivedAt: now },
      {
        policy: { ...policy, checkedAt: new Date(now + 300001).toISOString() },
        receivedAt: now,
      },
      { policy },
      null,
    ].map((value) => {
      // 거부한 캐시는 원본을 지우지 않고 사용하지 않는다.
      return usablePolicyCache(value, now);
    }),
    Array(6).fill(null),
  );
});

test('R08 온라인 정책은 인증 정보 없이 5초 제한 신호와 실제 수신 시각으로 저장한다', async () => {
  // 정책 조회 경계만 대체하고 실제 검증·저장 흐름을 실행한다.
  let saved: PolicyCache | undefined;
  const result = await loadAppPolicy('play', {
    baseUrl: 'https://api.test/',
    read: async () => {
      // 성공 조회는 오래된 캐시에 의존하지 않는다.
      return null;
    },
    save: async (cache) => {
      // 실제 저장 인자를 기록한다.
      saved = cache;
    },
    fetcher: async (url, init) => {
      // 세션·식별자 없이 공개 계약만 요청해야 한다.
      assert.equal(
        url,
        'https://api.test/public/app-config?platform=android&channel=play',
      );
      assert.equal(init?.headers, undefined);
      assert.ok(init?.signal instanceof AbortSignal);
      return Response.json({ data: policy });
    },
  });
  assert.deepEqual(result, { policy, source: 'online' });
  assert.deepEqual(saved?.policy, policy);
  assert.ok(Date.now() - saved!.receivedAt < 1000);
});

test('R08 명시적 null 성공은 오래된 필수 정책을 교체하고 저장 실패도 온라인 판정을 보존한다', async () => {
  // 정책 해제와 조회 실패를 섞지 않는다.
  const result = await loadAppPolicy('play', {
    baseUrl: 'https://api.test',
    read: async () => {
      // 온라인 성공에서는 이전 필수 정책을 사용하지 않는다.
      return { policy, receivedAt: Date.now() };
    },
    save: async (cache) => {
      // 저장소 실패가 실제 성공을 캐시 복구로 바꾸지 않는다.
      assert.equal(cache.policy, null);
      throw new Error('storage blocked');
    },
    fetcher: async () => {
      // 정책 미설정은 명시적 성공 응답이다.
      return Response.json({ data: null });
    },
  });
  assert.deepEqual(result, { policy: null, source: 'online' });
});

for (const failure of ['http', 'network', 'schema']) {
  test(`R08 ${failure} 실패는 유효 캐시만 사용하고 수신 시각을 갱신하지 않는다`, async () => {
    // 재시도 실패가 캐시 유효기간을 연장하지 않아야 한다.
    const cache = { policy, receivedAt: Date.now() - 5000 };
    const before = JSON.stringify(cache);
    const result = await loadAppPolicy('play', {
      baseUrl: 'https://api.test',
      read: async () => {
        // 이전 실제 성공 응답만 제공한다.
        return cache;
      },
      save: async () => {
        // 실패한 응답을 저장하면 검증을 중단한다.
        assert.fail('조회 실패는 저장하지 않는다');
      },
      fetcher: async () => {
        // 세 종류의 실패가 같은 유효 캐시 검사로 복구되는지 확인한다.
        if (failure === 'network') throw new Error('offline');
        return failure === 'http'
          ? new Response(null, { status: 503 })
          : Response.json({ data: { ...policy, minSupportedVersionCode: 99 } });
      },
    });
    assert.deepEqual(result, { policy, source: 'cached' });
    assert.equal(JSON.stringify(cache), before);
  });
}

test('R08 정책 조회 실패와 만료 캐시에서는 계정 점검을 계속한다', async () => {
  // 만료한 필수 정책으로 시작을 막거나 최신 성공으로 표시하지 않는다.
  return assert.deepEqual(
    await loadAppPolicy('play', {
      baseUrl: 'https://api.test',
      read: async () => {
        // 24시간 지난 마지막 성공 값을 반환한다.
        return { policy, receivedAt: Date.now() - policyLifetime };
      },
      save: async () => {
        // 실패한 정책은 저장하지 않는다.
        assert.fail('만료 캐시 재저장 금지');
      },
      fetcher: async () => {
        // 실제 연결 실패를 재현한다.
        throw new Error('offline');
      },
    }),
    { policy: null, source: 'unavailable' },
  );
});

test('R08 대상 외 채널은 네트워크·캐시·저장 없이 통과한다', async () => {
  // 직접 설치에서 Play 정책의 캐시를 재사용하지 않는다.
  return assert.deepEqual(
    await loadAppPolicy('direct', {
      baseUrl: 'https://api.test',
      read: async () => {
        // 대상 외 채널은 캐시에 접근하지 않는다.
        return assert.fail('캐시 접근 금지');
      },
      save: async () => {
        // 대상 외 채널은 저장하지 않는다.
        return assert.fail('정책 저장 금지');
      },
      fetcher: async () => {
        // 대상 외 채널은 요청하지 않는다.
        return assert.fail('정책 요청 금지');
      },
    }),
    { policy: null, source: 'not-applicable' },
  );
});

test('R08 실패 검사만 재시도하며 성공·진행 중 결과는 유지한다', () => {
  // 다른 점검 실패 때문에 Play·공통 버전·계정을 중복 확인하지 않는다.
  return assert.deepEqual(
    failedStartupChecks({
      common: { isError: true, isFetching: false },
      local: { isError: false, isFetching: false },
      play: { isError: false, isFetching: false },
      destination: { isError: true, isFetching: true },
    }),
    ['common'],
  );
});
