import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getMvpIssues } from '../../scripts/mvp-config.mjs';

const publicSettings = {
  EXPO_PUBLIC_BACKEND: 'cloudflare',
  EXPO_PUBLIC_API_URL: 'https://travel-stage.workers.dev',
  EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
    'https://travel-stage.pages.dev/auth/callback',
};

// 실제 EAS hook 진입점을 실행하여 프로필 조건을 확인한다.
function runHook(profile, settings) {
  // 테스트에 실제 계정·키·원격 요청은 사용하지 않는다.
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../scripts/check-mvp-build.mjs', import.meta.url),
      ),
      '--preview-only',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPO_PUBLIC_BACKEND: '',
        EXPO_PUBLIC_API_URL: '',
        EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL: '',
        ...settings,
        EAS_BUILD_PROFILE: profile,
      },
    },
  );
}

test('기존 development 프로필에는 새 MVP 공개 설정 조건을 적용하지 않는다', () => {
  // 개발 서버를 사용하는 기존 작업을 새 조건으로 차단하지 않는다.
  assert.equal(runHook('development', {}).status, 0);
});

test('preview의 빈 설정은 EAS hook에서 비정상 종료', () => {
  // 실제 APK 생성 전에 설정 오류가 반드시 실패 코드로 전달된다.
  assert.equal(runHook('preview', {}).status, 1);
  // 모바일 템플릿에 없는 릴리스 환경 이름을 요구하지 않는다.
  assert.ok(!runHook('preview', {}).stderr.includes('RELEASE_WEB_ORIGIN'));
});

test('preview의 공개 설정이 맞으면 EAS hook 통과', () => {
  // 형태 검사를 실제 계정 연결 인수로 혼동하지 않는다.
  assert.equal(runHook('preview', publicSettings).status, 0);
});

test('Play 내부 테스트도 서버 설정 누락을 거부하고 정상 설정을 허용한다', () => {
  // AAB 프로필이 APK와 동일한 사전 검사 없이 만들어지는 회귀를 방지한다.
  return assert.deepEqual(
    [
      runHook('play-internal', {}).status,
      runHook('play-internal', publicSettings).status,
    ],
    [1, 0],
  );
});

test('APK 검사는 공개 값 3개로 통과하고 OCR·스토어·Pages 계정 값을 요구하지 않음', () => {
  // EAS 로그인 여부와 공개 설정 검사는 서로 다른 단계다.
  assert.deepEqual(getMvpIssues(publicSettings), []);
});

test('빈 설정과 휴대폰 localhost 및 이전 백엔드 거부', () => {
  // 설정 없이 기능 테스트 APK 준비 완료로 판단하지 않는다.
  assert.ok(getMvpIssues({}).length);
  // 휴대폰은 PC localhost에 연결할 수 없다.
  assert.ok(
    getMvpIssues({
      ...publicSettings,
      EXPO_PUBLIC_API_URL: 'http://localhost:8787',
    }).length,
  );
  // 이전 백엔드 설정으로 현재 앱의 빌드를 통과시키지 않는다.
  assert.ok(
    getMvpIssues({
      ...publicSettings,
      EXPO_PUBLIC_BACKEND: 'supabase',
    }).length,
  );
});
