import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  releasePages,
  hasReleaseRewrites,
  hasUnsafeReleaseValues,
  hasSecurityHeaders,
} from '../../scripts/release/release-artifact-checks.mjs';

test('포트에 관계없이 로컬 검수 주소가 포함된 배포 번들을 거부한다', () => {
  // 다른 정적 문구에 staging 주소가 있어도 실제 로컬 요청 설정을 놓치지 않는다.
  for (const url of [
    'http://127.0.0.1:8810',
    'http://localhost:19006',
    'https://127.1.2.3:443',
    'http://[::1]:8081',
  ]) {
    assert.equal(
      hasUnsafeReleaseValues(
        JSON.stringify({
          api: url,
          text: 'https://tripprint-api-staging.gametps.workers.dev',
        }),
      ),
      true,
    );
  }
  assert.equal(
    hasUnsafeReleaseValues('https://tripprint-api-staging.gametps.workers.dev'),
    false,
  );
});

test('폐기한 루트 프로토타입의 데모 여행을 배포 청크에서 거부', () => {
  // 예전 초기 스토어를 다시 연결해도 배포 전 검사에서 중단한다.
  for (const id of ['trip-demo-1', 'trip-demo-2']) {
    assert.equal(hasUnsafeReleaseValues(JSON.stringify({ id })), true);
  }
});

test('가져오기와 발자국 직접 접근 HTML을 필수 산출물로 검사', () => {
  // 새 화면이 빠진 과거 웹 빌드를 공개하지 않도록 한다.
  return assert.ok(
    releasePages.includes('diary/[id].html') &&
      releasePages.includes('record/[id].html') &&
      releasePages.includes('import-place.html'),
  );
});

test('여행과 다이어리 모두 URL 유지 rewrite 필요', () => {
  // Windows와 CI의 줄바꿈 차이는 허용한다.
  return assert.equal(
    hasReleaseRewrites(
      '/trips/* /trips/[id] 200\r\n/diary/* /diary/[id] 200\r\n/record/* /record/[id] 200\r\n',
    ),
    true,
  );
});

test('다이어리 rewrite 누락과 외부 이동을 거부', () => {
  // 조회 가능한 로컬 화면만으로 실제 호스팅 경로를 판단하지 않는다.
  return assert.ok(
    [
      '/trips/* /trips/[id] 200',
      '/trips/* /trips/[id] 200\n/diary/* /diary/[id] 200',
      '/trips/* /trips/[id] 200\n/diary/* /diary/[id].html 302',
    ].every((content) => {
      // 일부 화면만 연결된 빌드는 준비 완료가 아니다.
      return !hasReleaseRewrites(content);
    }),
  );
});

test('테스트 인증 설정과 서버 비밀 키를 배포 청크에서 거부', () => {
  // 공개 키가 필요한 앱에 서버 키나 fixture를 넣지 않는다.
  return assert.ok(
    [
      'https://wherego-test.supabase.co',
      'sb_publishable_fixture',
      'sb_secret_test_only',
      'DEFAULT_DB_SECURITY_CODE',
      'INTERNAL_SECRET_SALT',
      'DB 보안 연동 코드',
      'Base64 XOR',
      'AUTH_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'CLOUDFLARE_API_TOKEN',
      '제주 푸른 바다 힐링 여행',
      '도쿄 골목 산책과 미식 여행',
      'JEJU-2026',
      'TOKYO-777',
      'preview@example.test',
      'home@example.test',
      'fixture@example.test',
      '가을 도쿄 산책',
      '시라하마에서 보내는 하루',
    ].every(hasUnsafeReleaseValues),
  );
});

test('일반 공개 설정은 산출물 검사에서 허용', () => {
  // 원격 프로젝트 존재와 실제 인증은 별도 인수에서 확인한다.
  return assert.equal(
    hasUnsafeReleaseValues('https://wherego-staging.pages.dev'),
    false,
  );
});

test('식별자 이름 없이 들어간 Stitch 키와 개인 키 원문도 배포 전에 거부', () => {
  // 환경 변수 이름을 없앤 값만 번들에 들어가도 비밀 검사가 작동해야 한다.
  for (const value of [
    `AQ.${'x'.repeat(40)}`,
    ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
    ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join(''),
  ]) {
    assert.equal(hasUnsafeReleaseValues(value), true);
  }
});

test('정적 웹 호스팅 보안 헤더(_headers) 필수 규격 검증', () => {
  // nosniff, DENY, HSTS, Referrer-Policy가 모두 포함된 설정은 통과한다.
  const validHeaders = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains`;
  assert.equal(hasSecurityHeaders(validHeaders), true);

  // 필수 보안 헤더 중 하나라도 누락되면 실패한다.
  const missingHsts = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin`;
  assert.equal(hasSecurityHeaders(missingHsts), false);
});
