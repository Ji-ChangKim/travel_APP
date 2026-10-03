import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getReleaseIssues,
  workerConfig,
} from '../../scripts/release-config.mjs';

const valid = {
  RELEASE_ENV: 'staging',
  RELEASE_WEB_ORIGIN: 'https://travel-stage.pages.dev',
  CLOUDFLARE_PAGES_PROJECT: 'travel-stage',
  EXPO_PUBLIC_API_URL: 'https://travel-stage.workers.dev',
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijk.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
    'https://travel-stage.pages.dev/auth/callback',
};

test('Worker는 선택 환경과 앱의 공개 설정만 사용', () => {
  // OCR 키나 배포 토큰을 설정 파일에 복사하지 않는다.
  assert.deepEqual(
    workerConfig({ ...valid, GOOGLE_VISION_API_KEY: 'private-value' }).vars,
    {
      SUPABASE_URL: valid.EXPO_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: valid.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ALLOWED_ORIGINS: valid.RELEASE_WEB_ORIGIN,
    },
  );
  // 환경 선택이 실제 Worker 이름에 반영된다.
  assert.equal(
    workerConfig({ ...valid, RELEASE_ENV: 'production' }).name,
    'wherego-api-production',
  );
  // MVP 테스트 환경은 OCR 키 없이 수동 입력을 허용한다.
  assert.deepEqual(workerConfig(valid).secrets.required, []);
  // 운영 환경의 OCR 필수 선언은 선택 환경에서 유지한다.
  assert.deepEqual(
    workerConfig({ ...valid, RELEASE_ENV: 'production' }).secrets.required,
    ['GOOGLE_VISION_API_KEY'],
  );
  // 중첩 환경의 빈 vars가 생성 값을 덮어쓸 수 없다.
  assert.equal(workerConfig(valid).env, undefined);
});

test('staging과 production의 일치하는 공개 설정 허용', () => {
  // 로컬 검증은 원격 프로젝트에 접속하지 않는다.
  assert.deepEqual(getReleaseIssues(valid), []);
  // 배포 환경은 두 종류를 명시적으로 지원한다.
  assert.deepEqual(
    getReleaseIssues({ ...valid, RELEASE_ENV: 'production' }),
    [],
  );
});

test('누락 설정과 fixture 주소 거부', () => {
  // 빈 설정으로 배포할 수 없다.
  assert.equal(getReleaseIssues({}).length, 7);
  // 화면 테스트 주소는 실제 배포에 사용하지 않는다.
  assert.ok(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_SUPABASE_URL: 'https://wherego-test.supabase.co',
    }).length,
  );
});

test('관리자 키를 거부하며 오류에는 키를 노출하지 않는다', () => {
  // 오류 메시지는 변수명만 포함한다.
  assert.ok(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_do_not_expose',
    }).every((message) => !message.includes('do_not_expose')),
  );
  // 관리자 키가 실제로 실패하는지도 확인한다.
  assert.ok(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_do_not_expose',
    }).length,
  );
});

test('복귀 도메인 불일치·로컬 API·URL 사용자 정보 거부', () => {
  // 인증과 초대는 같은 웹 도메인을 사용한다.
  assert.ok(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
        'https://other.pages.dev/auth/callback',
    }).length,
  );
  // 실기기에 전달할 주소에는 localhost를 쓰지 않는다.
  assert.ok(
    getReleaseIssues({ ...valid, EXPO_PUBLIC_API_URL: 'http://localhost:8787' })
      .length,
  );
  // URL 암호를 공개 번들에 포함하지 않는다.
  assert.ok(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_API_URL: 'https://user:pass@travel-stage.workers.dev',
    }).length,
  );
});
