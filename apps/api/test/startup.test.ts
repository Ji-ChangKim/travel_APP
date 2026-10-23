import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  startupManifestSchema,
  appConfigSchema,
  playStoreUrl,
} from '@wherego/validation';
import { createApp } from '../src/app';
import { commonDataVersion } from '../src/features/startup/startup';

test('공통 데이터 버전은 같은 목록·월에 안정적이고 월간 데이터 변경을 반영한다', async () => {
  // 임의 배포 시각 대신 실제 데이터 구성으로 버전을 비교한다.
  const first = await commonDataVersion(new Date('2026-10-12T00:00:00Z'));
  const same = await commonDataVersion(new Date('2026-10-15T00:00:00Z'));
  const next = await commonDataVersion(new Date('2026-11-12T00:00:00Z'));
  // 같은 공통 데이터는 불필요하게 캐시를 지우지 않는다.
  assert.equal(first, same);
  assert.notEqual(first, next);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('시작 확인은 로그인·DB·외부 소개 API 없이 실제 계약과 요청 ID를 반환한다', async () => {
  // 서버 자격 증명과 인증 헤더가 전혀 없는 요청으로 검사한다.
  const response = await createApp().request('/public/startup', {}, {});
  const body = (await response.json()) as {
    data: unknown;
    meta: { requestId: string };
  };
  // 앱에서 사용하는 같은 스키마로 공개 응답을 검증한다.
  assert.equal(response.status, 200);
  assert.equal(startupManifestSchema.parse(body.data).protocolVersion, 1);
  assert.match(body.meta.requestId, /^[a-f0-9-]{36}$/);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
});

const appPolicy = {
  platform: 'android',
  channel: 'play',
  latestVersionCode: 30,
  minSupportedVersionCode: 20,
  storeUrl: playStoreUrl,
  checkedAt: new Date().toISOString(),
};

test('R08 공개 앱 정책은 미확정 값에서 null을 반환하고 가짜 버전을 만들지 않는다', async () => {
  // 인증·DB·스토어 조회 없이 공개 미설정 계약을 확인한다.
  const response = await createApp().request(
    '/public/app-config?platform=android&channel=play',
    {},
    {},
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data, null);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
});

test('R08 확정한 정책은 같은 스키마와 요청 ID로 공개하고 대상 외 채널에는 적용하지 않는다', async () => {
  // 운영 환경의 검증한 JSON만 응답에 반영한다.
  const app = createApp();
  const bindings = { APP_UPDATE_POLICY_JSON: JSON.stringify(appPolicy) };
  const response = await app.request(
    '/public/app-config?platform=android&channel=play',
    {},
    bindings,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(appConfigSchema.parse(body.data), appPolicy);
  assert.match(body.meta.requestId, /^[a-f0-9-]{36}$/);
  for (const query of [
    'platform=android&channel=direct',
    'platform=android&channel=unknown',
    'platform=ios&channel=app-store',
    'platform=web&channel=web',
  ]) {
    // 다른 채널에는 Play 정책을 복사하지 않는다.
    assert.equal(
      (
        await (
          await app.request('/public/app-config?' + query, {}, bindings)
        ).json()
      ).data,
      null,
    );
  }
});

test('R08 잘못된 정책 쿼리는 거부하고 운영 설정 오류와 구분한다', async () => {
  // 누락·플랫폼 불일치·추가 입력을 묵인하지 않는다.
  for (const query of [
    '',
    'platform=web&channel=play',
    'platform=android&channel=play&extra=1',
  ]) {
    // 공개 정책도 요청 범위 검증을 적용한다.
    assert.equal(
      (await createApp().request('/public/app-config?' + query, {}, {})).status,
      422,
    );
  }
});

test('R08 파손·범위 오류·미래 시각 설정은 원문 없이 503으로 응답한다', async () => {
  // 잘못된 운영 설정을 정책 해제 성공으로 바꾸지 않는다.
  for (const value of [
    'secret-invalid-json',
    JSON.stringify({ ...appPolicy, minSupportedVersionCode: 31 }),
    JSON.stringify({
      ...appPolicy,
      checkedAt: new Date(Date.now() + 600000).toISOString(),
    }),
  ]) {
    // 설정 원문과 내부 예외는 외부 응답에 포함하지 않는다.
    const response = await createApp().request(
      '/public/app-config?platform=android&channel=play',
      {},
      { APP_UPDATE_POLICY_JSON: value },
    );
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /CONFIGURATION_REQUIRED/);
    assert.ok(!body.includes(value));
  }
});
